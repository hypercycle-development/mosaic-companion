// =============================================================================
// STARGATE FLEET PANEL — Discover, hire, and deploy to DAO fleet nodes
// =============================================================================
// Replaces the empty "Hire Agents" tab with real fleet node list + actions.
// =============================================================================

import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Avatar,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  LinearProgress,
  Tooltip,
  Badge,
} from '@mui/material';
import ComputerIcon from '@mui/icons-material/Computer';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import SchoolIcon from '@mui/icons-material/School';
import MemoryIcon from '@mui/icons-material/Memory';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { fleetDiscoveryService, FleetNode, FleetNodeStatus } from './FleetDiscoveryService';
import { hermesAgentOrchestrator, HireAgentParams, BookTrainingParams } from './HermesAgentOrchestrator';

const ROLES = ['developer', 'marketing', 'growth', 'uiux', 'data_analyst'] as const;
const TIERS = ['standard', 'high_performance', 'dedicated'] as const;

const StargateFleetPanel: React.FC = () => {
  const [nodes, setNodes] = useState<FleetNode[]>([]);
  const [statuses, setStatuses] = useState<Map<string, FleetNodeStatus>>(new Map());
  const [loading, setLoading] = useState(true);
  const [hireOpen, setHireOpen] = useState(false);
  const [trainOpen, setTrainOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<FleetNode | null>(null);
  const [hireForm, setHireForm] = useState<Partial<HireAgentParams>>({ role: 'developer', computeTier: 'standard', skills: [] });
  const [trainForm, setTrainForm] = useState<Partial<BookTrainingParams>>({ skillName: '' });

  useEffect(() => {
    loadFleet();
  }, []);

  const loadFleet = async () => {
    setLoading(true);
    const fleet = await fleetDiscoveryService.loadFleetRegistry();
    setNodes(fleet);
    const polled = await fleetDiscoveryService.pollFleetStatus(fleet);
    const map = new Map<string, FleetNodeStatus>();
    for (const s of polled) map.set(s.node.nodeId, s);
    setStatuses(map);
    setLoading(false);
  };

  const handleHire = async () => {
    if (!hireForm.agentName || !hireForm.role) return;
    const task = await hermesAgentOrchestrator.hireAgent({
      agentName: hireForm.agentName,
      role: hireForm.role,
      skills: hireForm.skills || [],
      computeTier: hireForm.computeTier || 'standard',
      targetNodeId: selectedNode?.nodeId,
    });
    console.log('[Fleet] Hired:', task.taskId);
    setHireOpen(false);
    setHireForm({ role: 'developer', computeTier: 'standard', skills: [] });
  };

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" sx={{ color: '#00f0ff' }}>Fleet</Typography>
        <Button variant="outlined" onClick={loadFleet} sx={{ color: '#00f0ff', borderColor: '#00f0ff' }}>
          Refresh
        </Button>
      </Box>

      {loading && nodes.length === 0 && (
        <LinearProgress sx={{ backgroundColor: '#0f0f23', '& .MuiLinearProgress-bar': { backgroundColor: '#00f0ff' } }} />
      )}

      {nodes.length === 0 && !loading && (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <ComputerIcon sx={{ fontSize: 64, color: '#2a2a4a', mb: 2 }} />
          <Typography variant="h5" sx={{ color: '#7f7fad' }}>No Fleet Nodes</Typography>
          <Typography variant="body2" sx={{ color: '#5a5a7a', mt: 1 }}>
            Set a fleet registry URL in Settings to discover DAO nodes.
          </Typography>
        </Box>
      )}

      <Grid container spacing={2}>
        {nodes.map((node) => {
          const s = statuses.get(node.nodeId);
          const isOnline = s?.online || false;
          return (
            <Grid item xs={12} md={6} lg={4} key={node.nodeId}>
              <Card
                sx={{
                  background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 100%)',
                  border: `1px solid ${isOnline ? '#00f0ff40' : '#ff2e6340'}`,
                  borderRadius: 2,
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                    <Avatar sx={{ bgcolor: isOnline ? '#00f0ff20' : '#ff2e6320', color: isOnline ? '#00f0ff' : '#ff2e63' }}>
                      {isOnline ? <CheckCircleIcon /> : <ErrorIcon />}
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle1" sx={{ color: '#e0e0ff', fontWeight: 600 }}>{node.name}</Typography>
                      <Typography variant="caption" sx={{ color: '#7f7fad' }}>{node.nodeId.slice(0, 12)}...</Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                    <Chip label={node.computeGrade} size="small" color={node.computeGrade === 'dedicated' ? 'secondary' : 'default'} />
                    <Chip label={node.hasHermes ? 'Hermes ✓' : 'No Hermes'} size="small" variant="outlined" />
                    {isOnline && <Chip label={`${s?.latencyMs}ms`} size="small" color="success" variant="outlined" />}
                  </Box>

                  <Typography variant="body2" sx={{ color: '#7f7fad' }}>
                    {node.apiHost}:{node.apiPort}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#5a5a7a' }}>
                    License: {node.anfeLicense.slice(0, 16)}...
                  </Typography>
                </CardContent>

                <CardActions sx={{ justifyContent: 'flex-end', gap: 1 }}>
                  <Button
                    size="small"
                    startIcon={<RocketLaunchIcon />}
                    onClick={() => { setSelectedNode(node); setHireOpen(true); }}
                    sx={{ color: '#00f0ff' }}
                  >
                    Hire Agent
                  </Button>
                  <Button
                    size="small"
                    startIcon={<SchoolIcon />}
                    onClick={() => { setSelectedNode(node); setTrainOpen(true); }}
                    sx={{ color: '#7f7fad' }}
                  >
                    Train
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Hire Dialog */}
      <Dialog open={hireOpen} onClose={() => setHireOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { background: '#0f0f23', border: '1px solid #2a2a4a' } }}
      >
        <DialogTitle sx={{ color: '#00f0ff' }}>Hire Agent @ {selectedNode?.name}</DialogTitle>
        <DialogContent>
          <TextField
            label="Agent Name"
            fullWidth
            margin="normal"
            value={hireForm.agentName || ''}
            onChange={(e) => setHireForm({ ...hireForm, agentName: e.target.value })}
            sx={{ input: { color: '#e0e0ff' }, label: { color: '#7f7fad' } }}
          />
          <TextField
            select
            label="Role"
            fullWidth
            margin="normal"
            value={hireForm.role}
            onChange={(e) => setHireForm({ ...hireForm, role: e.target.value as any })}
            sx={{ '& .MuiInputBase-input': { color: '#e0e0ff' }, label: { color: '#7f7fad' } }}
          >
            {ROLES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </TextField>
          <TextField
            select
            label="Compute Tier"
            fullWidth
            margin="normal"
            value={hireForm.computeTier}
            onChange={(e) => setHireForm({ ...hireForm, computeTier: e.target.value as any })}
            sx={{ '& .MuiInputBase-input': { color: '#e0e0ff' }, label: { color: '#7f7fad' } }}
          >
            {TIERS.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </TextField>
          <TextField
            label="Skills (comma separated)"
            fullWidth
            margin="normal"
            value={hireForm.skills?.join(', ') || ''}
            onChange={(e) => setHireForm({ ...hireForm, skills: e.target.value.split(',').map(s => s.trim()) })}
            sx={{ input: { color: '#e0e0ff' }, label: { color: '#7f7fad' } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHireOpen(false)} sx={{ color: '#7f7fad' }}>Cancel</Button>
          <Button onClick={handleHire} variant="contained" sx={{ backgroundColor: '#00f0ff', color: '#0f0f23' }}>Dispatch</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StargateFleetPanel;
