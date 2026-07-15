# UK Driver Recruitment Strategy
## Crawling & Outreach Analysis

**Date:** 2026-07-05  
**Goal:** Find 10 real UK drivers for beta testing SAFE Rev Pool  
**Method:** Web crawling + human outreach (your UK contact)

---

## 🔍 Analysis of Scraping Tools

### Tool Comparison

| Tool | Best For | UK Driver Use Case | Complexity |
|------|----------|-------------------|------------|
| **firecrawl** | API-based crawling, easy integration | ⭐⭐⭐⭐⭐ HIGH — Fast, reliable, handles JS | Low |
| **crawl4ai** | AI-extraction from pages | ⭐⭐⭐ MEDIUM — Good for structured data | Medium |
| **browser-use** | Browser automation (Playwright) | ⭐⭐⭐⭐ HIGH — Can login to platforms | Medium |
| **crawlee** (Apify) | Large-scale production crawling | ⭐⭐⭐⭐ HIGH — Enterprise grade | High |
| **scrapy** | Python custom spiders | ⭐⭐⭐ MEDIUM — Flexible but complex | High |
| **markitdown** | Convert content to markdown | ⭐⭐ LOW — Content processing only | Low |
| **Scrapling** | Lightweight alternative | ⭐⭐ LOW — Similar to Scrapy | Medium |
| **scrcpy** | Android screen mirroring | ⭐⭐⭐ MEDIUM — Mobile app scraping | High |
| **autoscraper** | Auto-ML scraping | ⭐⭐⭐⭐ HIGH — Learns from examples | Low |
| **curl-impersonate** | Bypass bot detection | ⭐⭐⭐⭐⭐ HIGH — Essential for platforms | Medium |

---

## 🎯 Recommended Stack for UK Driver Recruitment

### Primary: firecrawl + autoscraper
**Why:** Fastest setup, reliable extraction, handles UK freight sites

### Secondary: browser-use + curl-impersonate
**Why:** For platforms requiring login (LinkedIn, Facebook Groups)

---

## 📍 UK Driver Sources (Prioritized)

### Tier 1: High-Intent Platforms (Best ROI)

#### 1. **Courier Exchange** (courierexchange.co.uk)
```
What: Platform where couriers find loads
How: Scrape driver profiles, ratings, areas served
Value: Already active in freight, understand industry
Approach: "We're building 0% fee alternative. Join beta?"
```

#### 2. **AnyVan Driver App** (anyvan.com/drivers)
```
What: UK's largest man & van platform
How: Crawl public driver directories (if available)
Value: Experienced with platform model, frustrated by fees
Approach: "Keep 100% of what you earn. Switch to SAFE."
```

#### 3. **Shiply** (shiply.com)
```
What: Delivery auction site
How: Scrape active driver profiles
Value: Independent operators, tech-savvy
Approach: "No more bidding wars. AI matches you directly."
```

### Tier 2: Community Platforms (High Volume)

#### 4. **Facebook Groups**
```
Groups to search:
- "UK Courier Drivers"
- "Man & Van Services UK"
- "Haulage Exchange UK"
- "Self Employed Couriers UK"
- "Transport & Haulage UK"

How: Use browser-use to scrape member lists
Value: Communities of active drivers
Approach: Post in group + DM high-engagement members
```

#### 5. **LinkedIn**
```
Search: "courier" OR "haulage" OR "freight" AND "self-employed" AND "UK"
How: browser-use with LinkedIn Sales Navigator
Value: Professional drivers, higher quality
Approach: Connection request + personalized message
```

#### 6. **Gumtree Services** (gumtree.com)
```
Category: "Courier & Delivery Services"
How: Scrape service listings by location
Value: Active businesses looking for work
Approach: Direct outreach with beta offer
```

### Tier 3: Forums & Directories (Niche)

#### 7. **Transport Forum** (transportforum.co.uk)
```
What: Industry forum for hauliers
How: Extract user profiles from member list
Value: Knowledgeable, engaged community
```

#### 8. **Road Haulage Association** (rha.uk.net)
```
What: Industry association directory
How: Scrape member directory (if public)
Value: Verified, professional operators
```

#### 9. **Yell.com**
```
Category: "Courier Services"
How: Scrape business listings by city
Value: Established businesses with contact info
```

---

## 🤖 Technical Implementation

### Firecrawl Setup

```typescript
import FirecrawlApp from "@mendable/firecrawl-js";

const app = new FirecrawlApp({ apiKey: "fc-..." });

// Scrape Courier Exchange driver profiles
async function scrapeCourierDrivers() {
  const scrapeResult = await app.scrapeUrl("https://courierexchange.co.uk/drivers", {
    formats: ["markdown", "html"],
    onlyMainContent: true,
  });
  
  // Extract structured data
  const drivers = extractDriverProfiles(scrapeResult.markdown);
  return drivers;
}

// Extract using LLM (autoscraper pattern)
function extractDriverProfiles(content: string) {
  // Use Claude/GPT to extract:
  // - Name
  // - Location  
  // - Vehicle type
  // - Service areas
  // - Contact (if public)
  // - Rating/reviews
}
```

### Browser-Use for Facebook Groups

```python
# browser-use script for Facebook
from browser_use import Agent, Browser

async def scrape_facebook_drivers():
    browser = Browser()
    agent = Agent(
        task="""
        Navigate to Facebook group "UK Courier Drivers".
        Scroll and extract member names and profile links.
        Look for members with 'courier', 'driver', 'haulage' in bio.
        Save to JSON.
        """,
        llm="claude-sonnet-4-20250514",  # or your LLM
    )
    
    result = await agent.run()
    return result
```

### Autoscraper for Gumtree

```python
from autoscraper import AutoScraper

url = "https://www.gumtree.com/search?search_category=courier-services"

# Train scraper with examples
wanted_list = [
    "John's Man & Van - London",
    "Fast Courier Service Manchester",
    "£25/hour • Same day delivery",
]

scraper = AutoScraper()
result = scraper.build(url, wanted_list)

# Now extract from all pages
all_services = scraper.get_result_similar(url, grouped=True)
```

---

## 📧 Outreach Templates

### Template 1: Direct Email (From Crawled Data)

```
Subject: Beta Test: Keep 100% of Your Fare (vs AnyVan's 15%)

Hi [Name],

I found your profile on [Platform] and saw you operate in [City]. 

We're launching SAFE Rev Pool — a freight matching platform where 
drivers keep 100% of their fare instead of paying 15% to AnyVan.

What makes us different:
✓ 0% platform fees (you keep the full £400, not £340)
✓ Instant USDC payment (<30 seconds, not days)
✓ AI finds loads matching YOUR routes automatically

We're recruiting 10 beta drivers for our UK pilot. You'll get:
→ £100 USDC signup bonus
→ Guaranteed 10 loads in first month  
→ Direct WhatsApp support from founders

Interested? Reply with your:
- Vehicle type
- Operating area
- Phone number

Or book a 10-min call: [Calendly link]

Best,
Mauricio
SAFE Rev Pool
```

### Template 2: Facebook/LinkedIn DM

```
Hey [Name]! 

Saw you're a courier in [City]. Quick question — are you happy with 
platform fees eating into your earnings?

We're building something different: 0% fees, instant crypto payments, 
and AI that finds loads for your exact routes.

Looking for 10 UK drivers to beta test. £100 bonus + guaranteed loads.

Worth a 10-min chat?
```

### Template 3: WhatsApp (After Email Response)

```
Hi [Name], thanks for your interest!

Quick questions to see if we're a good fit:

1. What vehicle do you drive?
2. What areas do you cover?
3. How many loads do you typically do per week?
4. Do you have a crypto wallet, or need help setting one up?

Once I have this, I can send you the beta signup link.

Thanks!
Mauricio
```

---

## 📊 Recruitment Funnel

```
Stage 1: Crawl (Week 1-2)
├─ Scrape 500 driver contacts from Tier 1-2 sources
├─ Clean and deduplicate data
└─ Output: 300 unique prospects

Stage 2: Email (Week 2-3)
├─ Send personalized emails to 300 prospects
├─ Track opens/clicks/replies
└─ Expected: 30 replies (10% response rate)

Stage 3: Qualification (Week 3)
├─ WhatsApp calls with 30 interested drivers
├─ Qualify: vehicle, area, commitment
└─ Expected: 15 qualified drivers

Stage 4: Onboarding (Week 4)
├─ Send 10 drivers through onboarding
├─ Wallet setup, app training, first load
└─ Result: 10 active beta drivers

Stage 5: Retention (Ongoing)
├─ Weekly check-ins
├─ Load matching optimization
├─ Payment troubleshooting
└─ Goal: 8+ drivers still active at month 2
```

---

## 🛠️ Implementation Plan

### Week 1: Setup & Crawl

**Day 1-2: Tool Setup**
```bash
# Install firecrawl
npm install @mendable/firecrawl-js

# Setup autoscraper
pip install autoscraper

# Setup browser-use
pip install browser-use
playwright install

# Setup curl-impersonate
docker pull lwthiker/curl-impersonate
```

**Day 3-5: Crawl Tier 1 Sources**
- Courier Exchange: 200 driver profiles
- Shiply: 150 driver profiles
- Gumtree: 100 service listings

**Day 6-7: Data Cleaning**
- Deduplicate contacts
- Verify email formats
- Enrich with LinkedIn data
- Score by relevance

### Week 2: Outreach

**Day 8-10: Email Campaign**
- Send 300 personalized emails
- A/B test subject lines
- Track metrics

**Day 11-12: LinkedIn Outreach**
- Connect with 50 high-value drivers
- Send InMail messages
- Join relevant groups

**Day 13-14: Follow-ups**
- Send follow-up to non-responders
- Respond to interested replies
- Schedule WhatsApp calls

---

## 📈 Success Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| Contacts crawled | 500 | ? |
| Unique prospects | 300 | ? |
| Emails sent | 300 | ? |
| Open rate | 40% | ? |
| Reply rate | 10% | ? |
| Qualified drivers | 15 | ? |
| Onboarded drivers | 10 | ? |
| Cost per driver | £20 | ? |

---

## ⚠️ Legal & Ethics

### GDPR Compliance (UK)
```
✓ Only contact drivers with publicly available business contact info
✓ Provide clear opt-out mechanism
✓ Don't store data longer than necessary
✓ Be transparent about data use
✓ Honor unsubscribe requests immediately
```

### Platform Terms of Service
```
⚠️ Respect rate limits (max 1 req/sec)
⚠️ Don't login/automate against ToS without permission
⚠️ Only scrape public data (not private/protected)
⚠️ Rotate user agents and IPs if needed
```

---

## 🚀 Alternative: Quick-Start Without Crawling

If crawling takes too long, use **manual sourcing** first:

### Fastest Path to 10 Drivers

1. **Your Network** (Days 1-3)
   - Ask friends/family: "Know any van drivers?"
   - Post on personal social media
   - Target: 2-3 drivers

2. **Local Outreach** (Days 4-7)
   - Walk into local courier companies
   - Post flyers at truck stops (M1, M6 services)
   - Target: 2-3 drivers

3. **Paid Ads** (Days 8-14)
   - Facebook Ads: "UK Drivers: Keep 100% of your fare"
   - Budget: £200
   - Target: 5-6 drivers

**Total:** 10 drivers in 2 weeks, £200 cost vs £500+ for crawling setup

---

## ✅ Recommendation

**Hybrid Approach:**
1. **Immediate:** Use your network + paid ads for first 5 drivers (Week 1)
2. **Parallel:** Set up crawling for long-term pipeline (Week 2-4)
3. **Scale:** Once model proven, invest in full automation

**Why:** You need drivers NOW for testing. Don't wait for perfect crawl.

---

## 📝 Next Actions

### You (Mauricio)
- [ ] Post on personal Facebook/LinkedIn: "Looking for UK van/lorry drivers"
- [ ] Ask 10 friends: "Know any courier drivers?"
- [ ] Set up Firecrawl account
- [ ] Create Calendly booking link

### Your UK Contact
- [ ] Walk into 5 local courier companies
- [ ] Post flyers at 3 motorway services
- [ ] Join 10 Facebook courier groups, introduce SAFE
- [ ] Collect phone numbers for WhatsApp outreach

### AI Agents
- [ ] Build crawler for Courier Exchange
- [ ] Build crawler for Gumtree
- [ ] Create email automation workflow
- [ ] Track metrics dashboard

---

**Status:** Ready to execute  
**Priority:** HIGH — Blocker for Phase 2  
**Owner:** Split between Mauricio (tech) + UK contact (outreach)