
import React, { useState } from 'react';
import { 
  Home, 
  Settings, 
  Star, 
  Clock, 
  LayoutGrid, 
  ChevronLeft, 
  Plus,
  Database,
  FileText,
  Monitor,
  Share2,
  Cpu,
  Power,
  Sparkles
} from 'lucide-react';
import { SidebarItem, INTERNAL_HOME_URL, INTERNAL_SETTINGS_URL } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onNavigate: (url: string) => void;
  currentUrl: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle, onNavigate, currentUrl }) => {
  // Navigation Items
  const navItems: SidebarItem[] = [
    { id: 'home', label: 'Home', icon: 'Home', url: INTERNAL_HOME_URL },
    { id: 'bookmarks', label: 'Bookmarks', icon: 'Star', url: 'browser://bookmarks' },
    { id: 'history', label: 'History', icon: 'Clock', url: 'browser://history' },
    { id: 'settings', label: 'Configuration', icon: 'Settings', url: INTERNAL_SETTINGS_URL },
  ];

  // --- UI State for New Sections ---
  const [aiContexts, setAiContexts] = useState([
    { id: 'rag', label: 'Local Neural Index', icon: Database, active: true },
    { id: 'files', label: 'File System Bridge', icon: FileText, active: false },
    { id: 'screen', label: 'Visual Cortex', icon: Monitor, active: false },
  ]);

  const [isHypercycleConnected, setHypercycleConnected] = useState(true);
  const [peerCount, setPeerCount] = useState(8);

  const toggleContext = (id: string) => {
    setAiContexts(prev => prev.map(ctx => 
      ctx.id === id ? { ...ctx, active: !ctx.active } : ctx
    ));
  };

  const toggleHypercycle = () => {
    const newState = !isHypercycleConnected;
    setHypercycleConnected(newState);
    setPeerCount(newState ? Math.floor(Math.random() * 15) + 5 : 0);
  };

  const renderNavIcon = (iconName: string, className: string) => {
    switch (iconName) {
      case 'Home': return <Home className={className} />;
      case 'Settings': return <Settings className={className} />;
      case 'Star': return <Star className={className} />;
      case 'Clock': return <Clock className={className} />;
      default: return <LayoutGrid className={className} />;
    }
  };

  return (
    <aside 
      className={`
        relative h-full bg-black text-gray-300 flex flex-col border-r border-gray-900
        transition-all duration-300 ease-in-out select-none overflow-hidden font-sans
        ${isOpen ? 'w-72 opacity-100' : 'w-0 opacity-0 border-none'}
      `}
    >
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-gray-900 shrink-0 min-w-[18rem]">
        <div className="flex items-center gap-2 text-indigo-500">
             <Sparkles size={20} />
             <span className="font-bold text-white tracking-widest text-lg">MOSAIC</span>
        </div>
        <button 
          onClick={onToggle}
          className="p-1.5 hover:bg-gray-900 rounded-md transition-colors text-gray-500 hover:text-white"
        >
          <ChevronLeft size={18} />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto py-6 space-y-8 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent min-w-[18rem]">
        
        {/* 1. Main Navigation */}
        <nav className="space-y-1 px-3">
          {navItems.map((item) => {
            const isActive = currentUrl === item.url;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.url)}
                className={`
                  w-full flex items-center px-3 py-3 rounded-lg transition-all relative group
                  ${isActive ? 'bg-indigo-900/20 text-indigo-400 border border-indigo-500/10' : 'hover:bg-gray-900 text-gray-400 hover:text-gray-200 border border-transparent'}
                `}
              >
                {renderNavIcon(item.icon, `size-5 mr-3`)}
                <span className="text-sm font-medium tracking-wide">{item.label}</span>
                {isActive && <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />}
              </button>
            );
          })}
        </nav>

        {/* 2. AI Context */}
        <div className="space-y-2 px-3">
          <div className="px-3 mb-2 flex items-center justify-between text-[10px] font-bold text-gray-600 uppercase tracking-widest">
            <span>Neural Bridges</span>
            <Cpu size={12} />
          </div>
          
          {aiContexts.map((ctx) => (
            <div
              key={ctx.id}
              className="w-full flex items-center px-3 py-2.5 rounded-lg relative group cursor-pointer hover:bg-gray-900 transition-colors"
              onClick={() => toggleContext(ctx.id)}
            >
              <ctx.icon 
                className={`size-4 transition-colors mr-3 ${ctx.active ? 'text-indigo-400' : 'text-gray-600'}`} 
              />
              
              <div className="flex-1 flex items-center justify-between">
                <span className={`text-sm ${ctx.active ? 'text-gray-200' : 'text-gray-500'}`}>
                  {ctx.label}
                </span>
                
                {/* Techy Toggle */}
                <div className={`w-8 h-1.5 rounded-full transition-colors duration-200 relative ${ctx.active ? 'bg-indigo-900' : 'bg-gray-800'}`}>
                  <div className={`absolute -top-1 w-3.5 h-3.5 rounded-full shadow-sm transition-all duration-200 ${ctx.active ? 'left-[18px] bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'left-0 bg-gray-600'}`} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 3. P2P Network */}
        <div className="space-y-2 px-3">
             <div className="px-3">
                <div className="flex items-center justify-between text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3">
                  <span>Hypercycle Grid</span>
                  <Share2 size={12} />
                </div>
                
                <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800 backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${isHypercycleConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-red-500'}`} />
                      <span className={`text-xs font-mono ${isHypercycleConnected ? 'text-emerald-400' : 'text-gray-500'}`}>
                        {isHypercycleConnected ? 'NODE_ACTIVE' : 'OFFLINE'}
                      </span>
                    </div>
                    <button 
                      onClick={toggleHypercycle}
                      className="text-gray-500 hover:text-white transition-colors"
                    >
                      <Power size={14} />
                    </button>
                  </div>
                  
                  {isHypercycleConnected && (
                    <div className="space-y-2">
                         <div className="flex items-center justify-between text-xs text-gray-400">
                             <span>Peers</span>
                             <span className="font-mono text-indigo-400">{peerCount}</span>
                         </div>
                         <div className="flex items-center justify-between text-xs text-gray-400">
                             <span>Latency</span>
                             <span className="font-mono text-indigo-400">24ms</span>
                         </div>
                         <div className="w-full bg-gray-800 h-0.5 mt-2 rounded-full overflow-hidden">
                             <div className="bg-indigo-500 h-full w-2/3 animate-pulse" />
                         </div>
                    </div>
                  )}
                </div>
             </div>
        </div>

      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-900 shrink-0 bg-black min-w-[18rem]">
        <button className="flex items-center justify-center w-full bg-indigo-900/20 hover:bg-indigo-900/40 text-indigo-400 border border-indigo-500/20 rounded-lg p-3 transition-all hover:scale-[1.02]">
          <Plus size={16} />
          <span className="ml-2 text-xs font-bold tracking-wider uppercase">Add Knowledge Base</span>
        </button>
      </div>
    </aside>
  );
};
