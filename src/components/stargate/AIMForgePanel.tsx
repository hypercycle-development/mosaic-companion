// =============================================================================
// AIM FORGE PANEL — Guided AIM Builder for Stargate
// Tree nav + forms on left, file editor on right.
// =============================================================================

import React, { useState, useCallback, useEffect } from 'react';
import {
  Hammer, FileCode, Box, Settings, Zap, ChevronRight, ChevronDown,
  Plus, Trash2, Save, FolderOpen, Play, Upload, Download, AlertCircle,
  CheckCircle, Loader, Code, Eye, FileText, Terminal, Wand2
} from 'lucide-react';
import { toast } from 'react-toastify';
import {
  AIMForgeProject, AIMForgeEndpoint, AIMForgeInput, AIMForgeOutput,
  AIMForgeGenerationResult, GeneratedFile, aimForgeService, SHIM_CATALOG
} from '../../services/stargate/AIMForgeService';

export interface AIMForgePanelProps {
  onNavigateToChat?: (message: string) => void;
}

type TreeNodeId =
  | 'root'
  | 'identity'
  | 'model'
  | 'endpoints'
  | 'shims'
  | 'container'
  | 'manifest'
  | 'files';

interface TreeNode {
  id: TreeNodeId;
  label: string;
  icon: React.ReactNode;
  children?: TreeNodeId[];
}

const TREE: TreeNode[] = [
  {
    id: 'root', label: 'AIM Project', icon: <Hammer size={16} />,
    children: ['identity', 'model', 'endpoints', 'shims', 'container', 'manifest']
  },
  { id: 'identity', label: '1. Project Identity', icon: <FileText size={14} /> },
  { id: 'model', label: '2. Model Source', icon: <Zap size={14} /> },
  { id: 'endpoints', label: '3. Endpoints', icon: <Terminal size={14} /> },
  { id: 'shims', label: '4. Shims', icon: <Code size={14} /> },
  { id: 'container', label: '5. Container Config', icon: <Box size={14} /> },
  { id: 'manifest', label: '6. Manifest', icon: <Settings size={14} /> },
  { id: 'files', label: 'Generated Files', icon: <FileCode size={14} /> },
];

const FILE_HELPERS: Record<string, { why: string; what: string }> = {
  'config.yml': {
    why: 'Source of truth for the aim-py-gen generator.',
    what: 'HyperCycle reads this to understand endpoints, parameters, and model bindings.'
  },
  'manifest.json': {
    why: 'HyperCycle AIM manifest (v2.0.0).',
    what: 'Node Manager registers this. Must have "methods" not "input_methods".'
  },
  'app/main.py': {
    why: 'The Uvicorn server — the AIM "soul".',
    what: 'Contains AIM URI handlers mounted by pyhypercycle_aim. Auto-generated from config.yml.'
  },
  'Dockerfile': {
    why: 'Container build instructions.',
    what: 'Pinned deps, /container_mount fix, and starlette<0.30 are baked in automatically.'
  },
  'requirements.txt': {
    why: 'Python dependencies.',
    what: 'Auto-generated based on model type. Hermes wrappers get stripped ML deps to keep image small.'
  },
  'test.py': {
    why: 'Auto-generated integration tests.',
    what: 'Hits every endpoint with test values from your form to verify the AIM works.'
  },
};

export const AIMForgePanel: React.FC<AIMForgePanelProps> = ({ onNavigateToChat }) => {
  const [project, setProject] = useState<AIMForgeProject>(() =>
    aimForgeService.createDefaultProject('my-agent')
  );
  const [activeNode, setActiveNode] = useState<TreeNodeId>('identity');
  const [expanded, setExpanded] = useState<Set<TreeNodeId>>(new Set(['root', 'endpoints']));
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);
  const [editingFile, setEditingFile] = useState<GeneratedFile | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [projectDir, setProjectDir] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildLogs, setBuildLogs] = useState<string[]>([]);
  const [showFileNode, setShowFileNode] = useState(false);

  const toggleExpand = (id: TreeNodeId) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const updateProject = useCallback((patch: Partial<AIMForgeProject>) => {
    setProject(prev => {
      const next = { ...prev, ...patch };
      aimForgeService.updateProject(next);
      return next;
    });
  }, []);

  const addEndpoint = () => {
    const ep: AIMForgeEndpoint = {
      id: crypto.randomUUID(),
      name: 'NewEndpoint',
      uri: '/new',
      method: 'POST',
      isPublic: true,
      doc: '',
      inputs: [
        { id: crypto.randomUUID(), name: 'input', shim: 'text', label: 'Input', testValue: '"test"', testShim: 'text' }
      ],
      output: { name: 'result', shim: 'text', label: 'Result', testValue: '', testShim: 'text' }
    };
    updateProject({ endpoints: [...project.endpoints, ep] });
  };

  const removeEndpoint = (id: string) => {
    updateProject({ endpoints: project.endpoints.filter(e => e.id !== id) });
  };

  const updateEndpoint = (id: string, patch: Partial<AIMForgeEndpoint>) => {
    updateProject({
      endpoints: project.endpoints.map(e => e.id === id ? { ...e, ...patch } as AIMForgeEndpoint : e)
    });
  };

  const generateFiles = async () => {
    setIsGenerating(true);
    try {
      const result = await aimForgeService.generateFiles(project);
      if (!result.success) {
        toast.error(result.error || 'Generation failed');
        return;
      }
      setGeneratedFiles(result.files);
      setProjectDir(result.projectDir);
      setShowFileNode(true);
      setExpanded(prev => new Set([...prev, 'root', 'files']));
      setActiveNode('files');
      toast.success(`Generated ${result.files.length} files`);
    } finally {
      setIsGenerating(false);
    }
  };

  const writeToDisk = async () => {
    const dir = await aimForgeService.pickDirectory();
    if (!dir) return;
    const fullDir = `${dir}/${project.projectName}`;
    const res = await aimForgeService.writeProjectToDisk(fullDir, generatedFiles);
    if (res.success) {
      setProjectDir(fullDir);
      toast.success(`Saved to ${fullDir}`);
    } else {
      toast.error(res.error || 'Failed to write files');
    }
  };

  const buildDocker = async () => {
    if (!projectDir) {
      toast.error('Save project to disk first');
      return;
    }
    setIsBuilding(true);
    setBuildLogs([]);
    try {
      const result = await aimForgeService.buildDocker(
        projectDir, project.projectName, 'latest'
      );
      setBuildLogs(result.logs);
      if (result.success) {
        toast.success(`Image built: ${result.imageTag}`);
      } else {
        toast.error(result.error || 'Build failed');
      }
    } finally {
      setIsBuilding(false);
    }
  };

  const openFileInEditor = (file: GeneratedFile) => {
    setEditingFile(file);
    setEditorContent(file.content);
    setActiveNode('files');
  };

  const saveEditorContent = () => {
    if (!editingFile) return;
    const updated = generatedFiles.map(f =>
      f.path === editingFile.path ? { ...f, content: editorContent } : f
    );
    setGeneratedFiles(updated);
    setEditingFile({ ...editingFile, content: editorContent });
    toast.success(`${editingFile.path} updated`);
  };

  // ─── Tree Render ──────────────────────────────────────────────────────────

  const renderTreeNode = (node: TreeNode, depth = 0) => {
    const isExpanded = expanded.has(node.id);
    const hasChildren = (node.children && node.children.length > 0) || node.id === 'files';
    const isActive = activeNode === node.id;
    const isFileNode = node.id === 'files';

    return (
      <div key={node.id}>
        <button
          onClick={() => {
            if (hasChildren) toggleExpand(node.id);
            setActiveNode(node.id);
          }}
          className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
            isActive ? 'bg-cyan-600/20 text-cyan-400' : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          {hasChildren && (
            isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          )}
          {!hasChildren && <span className="w-[14px]" />}
          {node.icon}
          <span className="truncate">{node.label}</span>
          {isFileNode && generatedFiles.length > 0 && (
            <span className="ml-auto text-xs bg-gray-700 px-1.5 rounded">{generatedFiles.length}</span>
          )}
        </button>
        {isExpanded && hasChildren && node.children && (
          <div>
            {node.children.map(childId => {
              const child = TREE.find(t => t.id === childId);
              return child ? renderTreeNode(child, depth + 1) : null;
            })}
          </div>
        )}
        {isExpanded && isFileNode && (
          <div>
            {generatedFiles.map(file => (
              <button
                key={file.path}
                onClick={() => openFileInEditor(file)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg transition-colors ${
                  editingFile?.path === file.path
                    ? 'bg-cyan-600/20 text-cyan-400'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                }`}
                style={{ paddingLeft: `${28 + depth * 16}px` }}
              >
                <FileCode size={12} />
                <span className="truncate">{file.path}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ─── Form Sections ────────────────────────────────────────────────────────

  const renderIdentityForm = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <FileText size={18} className="text-cyan-400" />
        Project Identity
      </h3>
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">
            Project Name <span className="text-red-400">*</span>
            <span className="ml-2 text-gray-600" title="Must end with -aim">(?)</span>
          </label>
          <input
            type="text"
            value={project.projectName}
            onChange={e => updateProject({ projectName: e.target.value })}
            className={`w-full px-3 py-2 rounded-lg bg-gray-800 border text-sm text-white ${
              project.projectName.endsWith('-aim') ? 'border-gray-700' : 'border-red-500'
            }`}
            placeholder="my-agent-aim"
          />
          {!project.projectName.endsWith('-aim') && (
            <p className="text-xs text-red-400 mt-1">Name must end with -aim</p>
          )}
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Description</label>
          <textarea
            value={project.description}
            onChange={e => updateProject({ description: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white"
            rows={2}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Version</label>
            <input
              type="text"
              value={project.version}
              onChange={e => updateProject({ version: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Port</label>
            <input
              type="number"
              value={project.port}
              onChange={e => updateProject({ port: parseInt(e.target.value) || 4000 })}
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderModelForm = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <Zap size={18} className="text-purple-400" />
        Model Source
      </h3>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => updateProject({ modelType: 'generic' })}
          className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
            project.modelType === 'generic'
              ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
              : 'bg-gray-800 text-gray-400 border border-gray-700'
          }`}
        >
          Generic Model
        </button>
        <button
          onClick={() => updateProject({ modelType: 'hermes' })}
          className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
            project.modelType === 'hermes'
              ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
              : 'bg-gray-800 text-gray-400 border border-gray-700'
          }`}
        >
          Wrap Hermes Agent
        </button>
      </div>

      {project.modelType === 'generic' ? (
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Model Package (pip)</label>
            <input
              type="text"
              value={project.modelName || ''}
              onChange={e => updateProject({ modelName: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white"
              placeholder="transformers"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Module</label>
            <input
              type="text"
              value={project.modelModule || ''}
              onChange={e => updateProject({ modelModule: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Object Class</label>
            <input
              type="text"
              value={project.modelObject || ''}
              onChange={e => updateProject({ modelObject: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white"
              placeholder="AutoModelForCausalLM"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Init Args</label>
            <input
              type="text"
              value={project.modelObjectArgs || ''}
              onChange={e => updateProject({ modelObjectArgs: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white"
              placeholder='("gpt2")'
            />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Hermes Model</label>
            <input
              type="text"
              value={project.hermesModel || ''}
              onChange={e => updateProject({ hermesModel: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Provider</label>
            <select
              value={project.hermesProvider || 'ollama'}
              onChange={e => updateProject({ hermesProvider: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white"
            >
              <option value="ollama">ollama</option>
              <option value="openai">openai</option>
              <option value="anthropic">anthropic</option>
              <option value="xai">xai</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Base URL (optional)</label>
            <input
              type="text"
              value={project.hermesBaseUrl || ''}
              onChange={e => updateProject({ hermesBaseUrl: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white"
              placeholder="http://172.17.0.1:11434"
            />
          </div>
        </div>
      )}
    </div>
  );

  const renderEndpointsForm = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Terminal size={18} className="text-green-400" />
          Endpoints
        </h3>
        <button
          onClick={addEndpoint}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600/20 text-green-400 rounded-lg hover:bg-green-600/30"
        >
          <Plus size={12} /> Add
        </button>
      </div>
      <div className="space-y-3">
        {project.endpoints.map(ep => (
          <div key={ep.id} className="p-3 rounded-lg bg-gray-800/50 border border-gray-700 space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={ep.name}
                onChange={e => updateEndpoint(ep.id, { name: e.target.value })}
                className="flex-1 px-2 py-1 rounded bg-gray-800 border border-gray-700 text-sm text-white"
                placeholder="Endpoint name"
              />
              <input
                type="text"
                value={ep.uri}
                onChange={e => updateEndpoint(ep.id, { uri: e.target.value })}
                className="px-2 py-1 rounded bg-gray-800 border border-gray-700 text-sm text-white w-28"
                placeholder="/uri"
              />
              <select
                value={ep.method}
                onChange={e => updateEndpoint(ep.id, { method: e.target.value as 'POST' | 'GET' })}
                className="px-2 py-1 rounded bg-gray-800 border border-gray-700 text-sm text-white"
              >
                <option>POST</option>
                <option>GET</option>
              </select>
              <button
                onClick={() => removeEndpoint(ep.id)}
                className="p-1 text-red-400 hover:text-red-300"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <label className="flex items-center gap-1 text-gray-400">
                <input
                  type="checkbox"
                  checked={ep.isPublic}
                  onChange={e => updateEndpoint(ep.id, { isPublic: e.target.checked })}
                  className="rounded"
                />
                Public
              </label>
              <input
                type="text"
                value={ep.doc}
                onChange={e => updateEndpoint(ep.id, { doc: e.target.value })}
                className="flex-1 px-2 py-1 rounded bg-gray-800 border border-gray-700 text-gray-300 text-xs"
                placeholder="Documentation"
              />
            </div>
            {/* Inputs */}
            <div className="pl-2 border-l-2 border-gray-700 space-y-1">
              <p className="text-xs text-gray-500">Input Parameters</p>
              {ep.inputs.map((inp, idx) => (
                <div key={inp.id} className="flex gap-2">
                  <input
                    value={inp.name}
                    onChange={e => {
                      const inputs = [...ep.inputs];
                      inputs[idx] = { ...inputs[idx], name: e.target.value };
                      updateEndpoint(ep.id, { inputs });
                    }}
                    className="flex-1 px-2 py-1 rounded bg-gray-800 border border-gray-700 text-xs text-white"
                    placeholder="name"
                  />
                  <select
                    value={inp.shim}
                    onChange={e => {
                      const inputs = [...ep.inputs];
                      inputs[idx] = { ...inputs[idx], shim: e.target.value };
                      updateEndpoint(ep.id, { inputs });
                    }}
                    className="px-2 py-1 rounded bg-gray-800 border border-gray-700 text-xs text-white"
                  >
                    {SHIM_CATALOG.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
            {/* Output */}
            <div className="pl-2 border-l-2 border-gray-700">
              <p className="text-xs text-gray-500">Output</p>
              <div className="flex gap-2 mt-1">
                <input
                  value={ep.output.name}
                  onChange={e => updateEndpoint(ep.id, {
                    output: { ...ep.output, name: e.target.value }
                  })}
                  className="flex-1 px-2 py-1 rounded bg-gray-800 border border-gray-700 text-xs text-white"
                  placeholder="output name"
                />
                <select
                  value={ep.output.shim}
                  onChange={e => updateEndpoint(ep.id, {
                    output: { ...ep.output, shim: e.target.value }
                  })}
                  className="px-2 py-1 rounded bg-gray-800 border border-gray-700 text-xs text-white"
                >
                  {SHIM_CATALOG.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
          </div>
        ))}
        {project.endpoints.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-4">No endpoints yet. Click Add to create one.</p>
        )}
      </div>
    </div>
  );

  const renderShimsForm = () => {
    const usedShims = new Set<string>();
    project.endpoints.forEach(ep => {
      ep.inputs.forEach(i => usedShims.add(i.shim));
      usedShims.add(ep.output.shim);
    });
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Code size={18} className="text-yellow-400" />
          Shims (Auto-populated)
        </h3>
        <div className="space-y-2">
          {Array.from(usedShims).map(shim => {
            const meta = SHIM_CATALOG.find(s => s.value === shim);
            return (
              <div key={shim} className="flex items-center justify-between p-2 rounded-lg bg-gray-800/50 border border-gray-700">
                <div>
                  <span className="text-sm text-white">{meta?.label || shim}</span>
                  <p className="text-xs text-gray-500">{meta?.description || shim}</p>
                </div>
                <span className="text-xs text-gray-600 font-mono">{shim}</span>
              </div>
            );
          })}
          {usedShims.size === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">Add endpoints first — shims auto-populate from your selections.</p>
          )}
        </div>
      </div>
    );
  };

  const renderContainerForm = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <Box size={18} className="text-orange-400" />
        Container Config
      </h3>
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Base Image</label>
          <input
            type="text"
            value={project.container.baseImage}
            onChange={e => updateProject({ container: { ...project.container, baseImage: e.target.value } })}
            className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Expose Port</label>
          <input
            type="number"
            value={project.container.exposePort}
            onChange={e => updateProject({ container: { ...project.container, exposePort: parseInt(e.target.value) || 4000 } })}
            className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Environment Variables</label>
          <div className="space-y-1">
            {Object.entries(project.container.envVars).map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <input
                  value={k}
                  disabled
                  className="flex-1 px-2 py-1 rounded bg-gray-800 border border-gray-700 text-xs text-gray-400"
                />
                <input
                  value={v}
                  disabled
                  className="flex-1 px-2 py-1 rounded bg-gray-800 border border-gray-700 text-xs text-gray-400"
                />
              </div>
            ))}
            {Object.keys(project.container.envVars).length === 0 && (
              <p className="text-xs text-gray-500">None set. Hermes models auto-populate HERMES_MODEL, PROVIDER, etc.</p>
            )}
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Persist Directory</label>
          <input
            type="text"
            value={project.container.persistDirectory}
            onChange={e => updateProject({ container: { ...project.container, persistDirectory: e.target.value } })}
            className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white"
          />
        </div>
      </div>
    </div>
  );

  const renderManifestForm = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <Settings size={18} className="text-pink-400" />
        Manifest
      </h3>
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">License</label>
          <select
            value={project.manifest.license}
            onChange={e => updateProject({ manifest: { ...project.manifest, license: e.target.value } })}
            className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white"
          >
            <option>MIT</option>
            <option>Apache-2.0</option>
            <option>GPL-3.0</option>
            <option>Proprietary</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Docs URL</label>
          <input
            type="text"
            value={project.manifest.docUrl}
            onChange={e => updateProject({ manifest: { ...project.manifest, docUrl: e.target.value } })}
            className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Estimated Cost / Call</label>
          <input
            type="number"
            step="0.01"
            value={project.manifest.estimatedCostPerCall}
            onChange={e => updateProject({ manifest: { ...project.manifest, estimatedCostPerCall: parseFloat(e.target.value) || 0 } })}
            className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Cost Token</label>
          <input
            type="text"
            value={project.manifest.estimatedCostToken}
            onChange={e => updateProject({ manifest: { ...project.manifest, estimatedCostToken: e.target.value } })}
            className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white"
          />
        </div>
      </div>
    </div>
  );

  const renderFilesEditor = () => (
    <div className="h-full flex flex-col">
      {editingFile ? (
        <>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FileCode size={16} className="text-cyan-400" />
              <span className="text-sm font-medium text-white">{editingFile.path}</span>
              {FILE_HELPERS[editingFile.path]?.why && (
                <span className="text-xs text-gray-500" title={`${FILE_HELPERS[editingFile.path].why} ${FILE_HELPERS[editingFile.path].what}`}>
                  (?)
                </span>
              )}
            </div>
            <button
              onClick={saveEditorContent}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-cyan-600/20 text-cyan-400 rounded-lg hover:bg-cyan-600/30"
            >
              <Save size={12} /> Save
            </button>
          </div>
          <textarea
            value={editorContent}
            onChange={e => setEditorContent(e.target.value)}
            className="flex-1 w-full rounded-lg bg-gray-900 border border-gray-700 p-3 text-sm font-mono text-gray-300 resize-none focus:outline-none focus:border-cyan-500/50"
            spellCheck={false}
          />
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
          <FileCode size={48} className="mb-4 opacity-30" />
          <p className="text-sm">Select a file from the tree to edit</p>
          <p className="text-xs mt-2 opacity-50">Or click Generate Files to create your AIM project</p>
        </div>
      )}
    </div>
  );

  const renderActiveForm = () => {
    switch (activeNode) {
      case 'identity': return renderIdentityForm();
      case 'model': return renderModelForm();
      case 'endpoints': return renderEndpointsForm();
      case 'shims': return renderShimsForm();
      case 'container': return renderContainerForm();
      case 'manifest': return renderManifestForm();
      case 'files': return renderFilesEditor();
      default: return renderIdentityForm();
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="p-3 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Hammer size={18} className="text-cyan-400" />
          <h2 className="text-sm font-semibold text-white">AIM Forge: {project.projectName}</h2>
          {project.modelType === 'hermes' && (
            <span className="text-xs bg-cyan-600/20 text-cyan-400 px-2 py-0.5 rounded">Hermes</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={generateFiles}
            disabled={isGenerating || !project.projectName.endsWith('-aim')}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
          >
            {isGenerating ? <Loader size={12} className="animate-spin" /> : <Wand2 size={12} />}
            {isGenerating ? 'Generating...' : 'Generate Files'}
          </button>
          {generatedFiles.length > 0 && (
            <button
              onClick={writeToDisk}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              <FolderOpen size={12} /> Save to Disk
            </button>
          )}
        </div>
      </div>

      {/* Main split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Tree Nav */}
        <div className="w-56 border-r border-gray-800 overflow-y-auto p-2">
          {TREE.filter(n => n.id === 'root' || n.id === 'files').map(n => renderTreeNode(n))}
          <div className="mt-4 space-y-1">
            {TREE.filter(n => n.id !== 'root' && n.id !== 'files').map(n => (
              <button
                key={n.id}
                onClick={() => setActiveNode(n.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                  activeNode === n.id ? 'bg-cyan-600/20 text-cyan-400' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                {n.icon}
                {n.label}
              </button>
            ))}
          </div>

          {/* File list under editor when in files mode */}
          {showFileNode && (
            <div className="mt-4 pt-4 border-t border-gray-800">
              <p className="text-xs text-gray-500 px-3 mb-2">Generated Files</p>
              {generatedFiles.map(file => (
                <button
                  key={file.path}
                  onClick={() => openFileInEditor(file)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    editingFile?.path === file.path
                      ? 'bg-cyan-600/20 text-cyan-400'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <FileCode size={10} />
                  {file.path}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Form / Editor Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {renderActiveForm()}
        </div>
      </div>

      {/* Build bar */}
      {generatedFiles.length > 0 && (
        <div className="p-3 border-t border-gray-800 flex items-center gap-3">
          <button
            onClick={buildDocker}
            disabled={isBuilding}
            className="flex items-center gap-1 px-4 py-2 text-xs bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 text-white rounded-lg transition-colors"
          >
            {isBuilding ? <Loader size={12} className="animate-spin" /> : <Play size={12} />}
            Build Docker
          </button>
          {projectDir && (
            <span className="text-xs text-gray-500 truncate flex-1">{projectDir}</span>
          )}
          {buildLogs.length > 0 && (
            <div className="text-xs text-gray-500">
              {buildLogs.slice(-1)[0]}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIMForgePanel;
