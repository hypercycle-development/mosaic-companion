#!/usr/bin/env python3
"""
Hermes → Mosaic Skill Converter
Converts all Hermes skills to Mosaic native format with proper frontmatter
"""

import os
import re
import json
import shutil
from pathlib import Path
from datetime import datetime

# Configuration
HERMES_SKILLS_DIR = Path.home() / ".hermes" / "skills"
MOSAIC_BUNDLED_DIR = Path.home() / "mosaic-companion" / "bundled-skills"
MOSAIC_DOCS_DIR = Path.home() / "mosaic-companion" / "docs" / "skill-conversion"
CONVERSION_LOG = MOSAIC_DOCS_DIR / "conversion-log.json"

class SkillConverter:
    def __init__(self):
        self.converted = []
        self.failed = []
        self.skipped = []
        self.stats = {
            "total_hermes": 0,
            "converted": 0,
            "failed": 0,
            "skipped": 0
        }
    
    def parse_hermes_frontmatter(self, content: str) -> dict:
        """Extract frontmatter from Hermes SKILL.md"""
        fm_match = re.match(r'^---\s*\n(.*?)\s*\n---', content, re.DOTALL)
        if not fm_match:
            return {}
        
        fm = fm_match.group(1)
        result = {}
        
        # Extract fields
        patterns = {
            'name': r'^name:\s*["\']?([^"\n]+)["\']?',
            'description': r'^description:\s*["\']?(.+?)(?:\n\w|$)',
            'category': r'^category:\s*["\']?([^"\n]+)["\']?',
            'version': r'^version:\s*["\']?([^"\n]+)["\']?',
            'author': r'^author:\s*["\']?([^"\n]+)["\']?',
        }
        
        for key, pattern in patterns.items():
            match = re.search(pattern, fm, re.MULTILINE | re.DOTALL)
            if match:
                result[key] = match.group(1).strip().replace('\n', ' ')
        
        # Handle tags specially (array format)
        tags_match = re.search(r'^tags:\s*\n((?:\s+-\s+.+\n?)+)', fm, re.MULTILINE)
        if tags_match:
            tags_text = tags_match.group(1)
            result['tags'] = [t.strip().lstrip('- ') for t in tags_text.split('\n') if t.strip()]
        else:
            tags_match = re.search(r'^tags:\s*\[([^\]]+)\]', fm)
            if tags_match:
                result['tags'] = [t.strip().strip('"\'') for t in tags_match.group(1).split(',')]
        
        return result
    
    def convert_to_mosaic_format(self, skill_path: Path, category: str) -> dict:
        """Convert a single Hermes skill to Mosaic format"""
        skill_name = skill_path.name
        skill_file = skill_path / "SKILL.md"
        
        try:
            content = skill_file.read_text(encoding='utf-8', errors='ignore')
            fm = self.parse_hermes_frontmatter(content)
            
            if not fm.get('name'):
                # Use directory name as fallback
                fm['name'] = skill_name
            
            # Ensure description exists
            if not fm.get('description'):
                # Try to extract from first paragraph
                body_start = re.search(r'---\s*\n\n?(.+?)(?:\n\n|\n##|$)', content, re.DOTALL)
                if body_start:
                    fm['description'] = body_start.group(1).strip()[:200]
                else:
                    fm['description'] = f"Mosaic-native skill: {skill_name}"
            
            # Build new Mosaic frontmatter
            mosaic_content = self._build_mosaic_skill(fm, content, category)
            
            return {
                'success': True,
                'skill_name': skill_name,
                'mosaic_name': fm['name'],
                'category': category,
                'content': mosaic_content,
                'original_path': str(skill_file),
                'original_frontmatter': fm
            }
            
        except Exception as e:
            return {
                'success': False,
                'skill_name': skill_name,
                'error': str(e),
                'original_path': str(skill_file)
            }
    
    def _build_mosaic_skill(self, fm: dict, original_content: str, category: str) -> str:
        """Build Mosaic-compatible skill content"""
        
        # Extract body (content after frontmatter)
        body_match = re.search(r'^---\s*\n.*?\n---\s*\n?(.*)', original_content, re.DOTALL)
        body = body_match.group(1) if body_match else original_content
        
        # Clean up body
        body = body.strip()
        
        # Ensure category is set
        if 'category' not in fm or not fm['category']:
            fm['category'] = category
        
        # Build Mosaic frontmatter
        lines = [
            "---",
            f"name: {fm['name']}",
            f"description: \"{fm['description'][:200]}\"",
        ]
        
        if fm.get('version'):
            lines.append(f"version: {fm['version']}")
        
        if fm.get('author'):
            lines.append(f"author: {fm['author']}")
        
        if fm.get('category'):
            lines.append(f"category: {fm['category']}")
        
        if fm.get('tags'):
            tags_str = json.dumps(fm['tags'])
            lines.append(f"tags: {tags_str}")
        
        # Add source info
        lines.append(f"source: hermes-converted")
        lines.append(f"converted_at: {datetime.now().isoformat()}")
        lines.append("---")
        lines.append("")
        lines.append(body)
        
        return '\n'.join(lines)
    
    def write_mosaic_skill(self, result: dict, output_dir: Path) -> bool:
        """Write converted skill to Mosaic bundled-skills directory"""
        if not result['success']:
            return False
        
        try:
            skill_dir = output_dir / result['mosaic_name']
            skill_dir.mkdir(parents=True, exist_ok=True)
            
            skill_file = skill_dir / "SKILL.md"
            skill_file.write_text(result['content'], encoding='utf-8')
            
            return True
        except Exception as e:
            print(f"  ❌ Failed to write {result['skill_name']}: {e}")
            return False
    
    def convert_all(self, dry_run: bool = True):
        """Convert all Hermes skills to Mosaic format"""
        
        print("=" * 70)
        print("HERMES → MOSAIC SKILL CONVERSION")
        print("=" * 70)
        print(f"\n📁 Source: {HERMES_SKILLS_DIR}")
        print(f"📁 Target: {MOSAIC_BUNDLED_DIR}")
        print(f"📁 Docs: {MOSAIC_DOCS_DIR}")
        print(f"\n🔧 Mode: {'DRY RUN (no files written)' if dry_run else 'LIVE (files will be written)'}")
        
        # Ensure docs directory exists
        MOSAIC_DOCS_DIR.mkdir(parents=True, exist_ok=True)
        
        # Find all Hermes skills
        hermes_skills = []
        for cat_dir in HERMES_SKILLS_DIR.iterdir():
            if not cat_dir.is_dir() or cat_dir.name.startswith('.'):
                continue
            
            for skill_dir in cat_dir.iterdir():
                if skill_dir.is_dir() and (skill_dir / "SKILL.md").exists():
                    hermes_skills.append({
                        'path': skill_dir,
                        'category': cat_dir.name
                    })
        
        self.stats['total_hermes'] = len(hermes_skills)
        print(f"\n📊 Found {len(hermes_skills)} Hermes skills")
        
        # Convert each skill
        print("\n🔄 Converting skills...")
        
        for i, skill_info in enumerate(hermes_skills, 1):
            skill_path = skill_info['path']
            category = skill_info['category']
            
            # Skip if already exists in Mosaic
            mosaic_skill_dir = MOSAIC_BUNDLED_DIR / skill_path.name
            if mosaic_skill_dir.exists() and not dry_run:
                self.skipped.append(skill_path.name)
                self.stats['skipped'] += 1
                continue
            
            result = self.convert_to_mosaic_format(skill_path, category)
            
            if result['success']:
                self.converted.append(result)
                self.stats['converted'] += 1
                
                if not dry_run:
                    self.write_mosaic_skill(result, MOSAIC_BUNDLED_DIR)
                
                if i <= 5 or i % 50 == 0:
                    print(f"  ✅ {i}/{len(hermes_skills)}: {result['mosaic_name']} ({category})")
            else:
                self.failed.append(result)
                self.stats['failed'] += 1
                print(f"  ❌ {i}/{len(hermes_skills)}: {skill_path.name} - {result.get('error', 'unknown')}")
        
        # Save conversion log
        if not dry_run:
            self._save_conversion_log()
            self._generate_documentation()
        
        # Print summary
        print("\n" + "=" * 70)
        print("CONVERSION SUMMARY")
        print("=" * 70)
        print(f"✅ Converted:  {self.stats['converted']}")
        print(f"⏭️  Skipped:   {self.stats['skipped']} (already exist)")
        print(f"❌ Failed:    {self.stats['failed']}")
        print(f"📊 Total:     {self.stats['total_hermes']}")
        
        if dry_run:
            print(f"\n🔧 This was a DRY RUN. No files were written.")
            print(f"   Run with dry_run=False to actually convert.")
        else:
            print(f"\n✅ Skills written to: {MOSAIC_BUNDLED_DIR}")
            print(f"📖 Documentation: {MOSAIC_DOCS_DIR}")
        
        return self.stats
    
    def _save_conversion_log(self):
        """Save conversion results to log file"""
        log_data = {
            'timestamp': datetime.now().isoformat(),
            'stats': self.stats,
            'converted': [{'name': r['mosaic_name'], 'category': r['category'], 'path': r['original_path']} for r in self.converted[:100]],
            'failed': [{'name': r['skill_name'], 'error': r.get('error')} for r in self.failed]
        }
        CONVERSION_LOG.write_text(json.dumps(log_data, indent=2), encoding='utf-8')
    
    def _generate_documentation(self):
        """Generate conversion documentation"""
        doc_content = f"""# Hermes → Mosaic Skill Conversion

## Overview

Converted **{self.stats['converted']}** Hermes skills to Mosaic native format.

## Conversion Details

- **Source:** `{HERMES_SKILLS_DIR}`
- **Target:** `{MOSAIC_BUNDLED_DIR}`
- **Date:** {datetime.now().isoformat()}

## Stats

| Metric | Count |
|--------|-------|
| Converted | {self.stats['converted']} |
| Skipped | {self.stats['skipped']} |
| Failed | {self.stats['failed']} |
| **Total** | {self.stats['total_hermes']} |

## Categories Converted

"""
        
        # Group by category
        by_category = {}
        for r in self.converted:
            cat = r['category']
            if cat not in by_category:
                by_category[cat] = []
            by_category[cat].append(r['mosaic_name'])
        
        for cat, skills in sorted(by_category.items()):
            doc_content += f"\\n### {cat} ({len(skills)} skills)\\n\\n"
            for skill in skills[:10]:  # First 10
                doc_content += f"- `{skill}`\\n"
            if len(skills) > 10:
                doc_content += f"- ... and {len(skills) - 10} more\\n"
        
        doc_content += f"""

## How Mosaic Bot Uses These Skills

1. **Auto-loaded:** All skills in `{MOSAIC_BUNDLED_DIR}` are automatically loaded at startup
2. **Runtime access:** Skills are available via `TOOL:load_skill`{{"name": "skill-name"}}
3. **Frontmatter:** Each skill has Mosaic-compatible frontmatter with:
   - `name`: Skill identifier
   - `description`: What the skill does
   - `category`: Original Hermes category
   - `source: hermes-converted`: Indicates conversion origin
   - `converted_at`: Timestamp

## Verification

To verify skills are loaded:

```bash
# Check Mosaic bundled skills count
ls -la {MOSAIC_BUNDLED_DIR} | wc -l

# Check specific skill
cat {MOSAIC_BUNDLED_DIR}/<skill-name>/SKILL.md | head -20
```

## Maintenance

If you add new Hermes skills:
1. Re-run the converter
2. It will skip existing skills and convert new ones
3. The conversion log tracks all changes
"""
        
        doc_file = MOSAIC_DOCS_DIR / "CONVERSION.md"
        doc_file.write_text(doc_content, encoding='utf-8')


if __name__ == "__main__":
    import sys
    
    dry_run = "--live" not in sys.argv
    
    converter = SkillConverter()
    converter.convert_all(dry_run=dry_run)
    
    print("\\n✅ Conversion complete!")
    print(f"   Run with --live flag to actually write files")
