// Frontend API Client for SolarScout UK Express Backend
const API_BASE_URL = import.meta.env.VITE_SOLAR_API_URL || 'http://localhost:5000';

const getHeaders = (token?: string) => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const solarApi = {
  // Discovery
  discover: async (postcode: string, keywords: string[], radius: number, userId: string, token?: string) => {
    const response = await fetch(`${API_BASE_URL}/api/discover`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ postcode, keywords, radius, userId }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to discover prospects');
    }
    return response.json();
  },

  // Enrichment
  enrich: async (prospectIds: string[], userId: string, token?: string) => {
    const response = await fetch(`${API_BASE_URL}/api/enrich`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ prospectIds, userId }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to trigger enrichment');
    }
    return response.json();
  },

  // Prospects Retrieval
  getProspects: async (filters: {
    priority?: string;
    status?: string;
    postcode?: string;
    minScore?: number;
    limit?: number;
    offset?: number;
    userId: string;
  }, token?: string) => {
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val !== undefined && val !== '') {
        queryParams.append(key, val.toString());
      }
    });

    const response = await fetch(`${API_BASE_URL}/api/prospects?${queryParams.toString()}`, {
      method: 'GET',
      headers: getHeaders(token),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to load prospects');
    }
    return response.json();
  },

  // Update Status/Notes
  updateProspect: async (
    id: string, 
    data: { status?: string; priority?: string; notes?: string; userId: string },
    token?: string
  ) => {
    const response = await fetch(`${API_BASE_URL}/api/prospects/${id}`, {
      method: 'PATCH',
      headers: getHeaders(token),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to update prospect');
    }
    return response.json();
  },

  // Dashboard Statistics
  getDashboard: async (userId: string, token?: string) => {
    const response = await fetch(`${API_BASE_URL}/api/dashboard?userId=${userId}`, {
      method: 'GET',
      headers: getHeaders(token),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to load dashboard metrics');
    }
    return response.json();
  },

  // Export CSV
  exportCsv: async (userId: string, token?: string) => {
    const response = await fetch(`${API_BASE_URL}/api/export`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ userId, format: 'csv' }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to export prospects');
    }
    
    // Download File Blob
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `solarscout_leads_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },

  // API Keys
  getKeys: async (userId: string, token?: string) => {
    const response = await fetch(`${API_BASE_URL}/api/keys?userId=${userId}`, {
      method: 'GET',
      headers: getHeaders(token),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to fetch API keys');
    }
    return response.json();
  },

  saveKeys: async (
    keys: {
      userId: string;
      google_places?: string;
      companies_house?: string;
      apollo?: string;
      hunter?: string;
      lusha?: string;
      zerobounce?: string;
    },
    token?: string
  ) => {
    const response = await fetch(`${API_BASE_URL}/api/keys`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(keys),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to save API keys');
    }
    return response.json();
  },

  // Get logs
  getLogs: async (prospectId: string, userId: string, token?: string) => {
    const response = await fetch(`${API_BASE_URL}/api/prospects/${prospectId}/logs?userId=${userId}`, {
      method: 'GET',
      headers: getHeaders(token),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to load activity logs');
    }
    return response.json();
  }
};
