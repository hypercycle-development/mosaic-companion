/**
 * Ollama Integration Page
 * Local LLM model management and chat interface
 */

import React, { useState, useEffect } from "react";
import { Download, Trash2, Play, Server, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";

interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
  pulls: number;
}

export function OllamaPage() {
  const [models, setModels] = useState<OllamaModel[]>([
    { name: "llama3.2:latest", size: 2_000_000_000, modified_at: "2024-01-15", pulls: 1250 },
    { name: "qwen2.5:14b", size: 8_500_000_000, modified_at: "2024-01-10", pulls: 890 },
    { name: "codellama:7b", size: 3_800_000_000, modified_at: "2024-01-05", pulls: 567 },
    { name: "mistral:7b", size: 4_100_000_000, modified_at: "2024-01-01", pulls: 432 },
  ]);
  const [connected, setConnected] = useState(true);
  const [loading, setLoading] = useState(false);
  const [pullModel, setPullModel] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([
    { role: "assistant", content: "Hello! I'm running on Ollama. What would you like to discuss?" }
  ]);

  const formatSize = (bytes: number) => {
    if (bytes < 1_000_000_000) return `${(bytes / 1_000_000).toFixed(1)}MB`;
    return `${(bytes / 1_000_000_000).toFixed(1)}GB`;
  };

  const handlePull = async () => {
    if (!pullModel.trim()) return;
    setLoading(true);
    // Simulate pull
    setTimeout(() => {
      setModels([...models, { name: pullModel, size: 0, modified_at: new Date().toISOString(), pulls: 0 }]);
      setPullModel("");
      setLoading(false);
    }, 2000);
  };

  const handleChat = async () => {
    if (!chatMessage.trim()) return;
    setChatHistory([...chatHistory, { role: "user", content: chatMessage }]);
    setChatMessage("");
    // Simulate response
    setTimeout(() => {
      setChatHistory(prev => [...prev, { 
        role: "assistant", 
        content: `This is a response from Ollama about "${chatMessage.slice(0, 30)}..."` 
      }]);
    }, 500);
  };

  return (
    <div className="h-full flex">
      {/* Models Panel */}
      <div className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-100">Models</h2>
            <button 
              onClick={() => setConnected(!connected)}
              className={`flex items-center gap-1 text-xs ${connected ? "text-green-400" : "text-red-400"}`}
            >
              {connected ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
              {connected ? "Connected" : "Disconnected"}
            </button>
          </div>
          
          {/* Pull Model Input */}
          <div className="flex gap-1">
            <input
              type="text"
              placeholder="model:name"
              value={pullModel}
              onChange={(e) => setPullModel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePull()}
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200"
            />
            <button 
              onClick={handlePull}
              disabled={loading}
              className="p-1.5 bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {models.map((model, i) => (
            <div key={i} className="group flex items-center justify-between p-2 rounded hover:bg-gray-800 cursor-pointer">
              <div>
                <div className="text-sm text-gray-200 font-mono">{model.name}</div>
                <div className="text-xs text-gray-500">{formatSize(model.size)} • {model.pulls} pulls</div>
              </div>
              <button className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-400">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-gray-800 flex items-center gap-2">
          <Server size={18} className="text-indigo-400" />
          <h1 className="text-xl font-bold text-gray-100">Ollama</h1>
          <span className="text-sm text-gray-500">Local LLM Interface</span>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chatHistory.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[70%] rounded-lg p-3 ${
                msg.role === "user" 
                  ? "bg-indigo-600 text-white" 
                  : "bg-gray-800 text-gray-200"
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-800">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Send a message..."
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleChat()}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-gray-200"
            />
            <button 
              onClick={handleChat}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
            >
              <Play size={16} />
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}