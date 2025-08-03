import React, { useState, useEffect } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Play, Database, Settings, BarChart3, Table, Bell, ChevronDown, User, X, Minimize2, Menu, ChevronLeft, ChevronRight } from 'lucide-react';

const ClusteringDashboard = () => {
  const [formData, setFormData] = useState({
    table_name: '',
    selected_features: [],
    algorithm: '',
    num_clusters: 3,
    normalize: '',
    eps: 0.5,
    min_samples: 5
  });

  const [selectedDropdownValue, setSelectedDropdownValue] = useState("");
  const [availableTables, setAvailableTables] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadedTable, setUploadedTable] = useState('');
  const [availableFeatures, setAvailableFeatures] = useState([]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [leftPanelState, setLeftPanelState] = useState('open');
  const [isMobile, setIsMobile] = useState(false);

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // On mobile, default to minimized panel instead of closed
      if (mobile && leftPanelState === 'open') {
        setLeftPanelState('minimized');
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const fetchTables = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/available_tables");
        if (!res.ok) throw new Error("Failed to fetch table list");
        const tables = await res.json();
        setAvailableTables(tables);
      } catch (err) {
        console.error("Error fetching tables:", err);
      }
    };

    fetchTables();
  }, []);

  const [columns, setColumns] = useState([]);

  useEffect(() => {
    if (!formData.table_name) return;

    fetch(`/available_columns?table_name=${formData.table_name}`)
      .then((res) => res.json())
      .then((data) => {
        setColumns(data); // original column names preserved
      })
      .catch((err) => {
        console.error("Failed to fetch columns:", err);
      });
  }, [formData.table_name]);



  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.user-dropdown')) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);


  // Fetch clustering-compatible (numeric) columns based on selected table
  useEffect(() => {
    const fetchAvailableColumns = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:8000/available_columns?table_name=${formData.table_name}`);
        if (!response.ok) {
          throw new Error("Failed to fetch features");
        }
        const data = await response.json();
        setAvailableFeatures(data); // preserve casing and spaces
        console.log("📊 Available features:", data);
        setResults(null);
        setFormData((prev) => ({
          ...prev,
          selected_features: prev.selected_features.filter((f) =>
            data.map((col) => col.name).includes(f)
          )
        }));

      } catch (error) {
        console.error("Error fetching available columns:", error);
        setAvailableFeatures([]);
      }
    };

    fetchAvailableColumns();
  }, [formData.table_name]);


  // Color palette for clusters
  const clusterColors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };



  const handleUpload = async () => {
    if (!uploadFile || !uploadedTable.trim()) {
      setError("Please select a file and enter a table name.");
      return;
    }

    const form = new FormData();
    form.append("file", uploadFile);

    const res = await fetch(`http://localhost:8000/upload?table_name=${encodeURIComponent(uploadedTable)}`, {
      method: 'POST',
      body: form,
    });


    const url = `http://127.0.0.1:8000/upload?table_name=${uploadedTable.trim()}`;
    console.log("⬆️ Uploading to:", url);

    try {
      const response = await fetch(url, {
        method: "POST",
        body: form,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Upload failed: ${errText}`);
      }

      const data = await response.json();
      console.log("✅ Upload response:", data);

      setFormData((prev) => ({
        ...prev,
        table_name: data.table_name,
        selected_features: []
      }));

      setAvailableFeatures(data.available_columns);  // Use as-is, it's already an array of {name, type}
      setUploadFile(null);             // <-- reset file input
      setUploadedTable(''); 
      // ✅ Fetch the updated list of tables
      const tablesResponse = await fetch("http://127.0.0.1:8000/available_tables");
      const tables = await tablesResponse.json();
      setAvailableTables(tables);
      setError(""); // clear previous errors if any
    } catch (err) {
      console.error("❌ Upload error:", err);
      setError(err.message);
    }
  };



  const handleSubmit = async () => {
    // setLoading(true);
    setError(null);
  
    // Frontend validation
    if (!formData.table_name.trim()) {
      setError("Please enter a table name.");
      return;
    }
    if (formData.selected_features.length < 2) {
      setError("Please select at least two features for clustering.");
      return;
    }
    if (!formData.algorithm) {
      setError("Please select a clustering algorithm.");
      return;
    }
    if (!formData.normalize) {
      setError("Please select a normalization method.");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        table_name: formData.table_name,
        columns: formData.selected_features,  // send array
        params: {
          algorithm: formData.algorithm,
          num_clusters: formData.num_clusters,
          normalize: formData.normalize,
          eps: formData.eps,
          min_samples: formData.min_samples
        }
      };

      const response = await fetch('http://127.0.0.1:8000/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setResults(data);

      if (isMobile) {
        setLeftPanelState('minimized');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const scatterData = results?.chart_data?.scatter_data
    ? results.chart_data.scatter_data.x.map((x, i) => ({
        x: x,
        y: results.chart_data.scatter_data.y[i],
        cluster: results.chart_data.scatter_data.labels[i]
      }))
    : [];

  const featureX = formData.selected_features[0] ?? "Feature X";
  const featureY = formData.selected_features[1] ?? "Feature Y";

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      {/* Overlay for mobile when panel is open */}
      {isMobile && leftPanelState === 'open' && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setLeftPanelState('minimized')}
        />
      )}

      {/* Left Panel - Inputs */}
      <div
        className={`
          ${leftPanelState === 'minimized' ? 'w-16' : isMobile ? 'w-full' : 'w-96'}
          ${isMobile && leftPanelState === 'open' ? 'fixed inset-y-0 left-0 z-40' : 'relative'}
          bg-white shadow-lg border-r border-gray-200 flex flex-col transition-all duration-300
          h-screen
        `}
      >
        <div className="p-5 md:p-7 border-b border-gray-200 bg-blue-600">
          <div className="flex items-center justify-between">
            <div className={`${leftPanelState === 'minimized' ? 'flex justify-center' : 'block'}`}>
              <div className="flex items-center">
                <Database className="w-6 h-6 text-white flex-shrink-0" />
                {leftPanelState === 'open' && (
                  <h1 className="text-xl md:text-2xl font-semibold text-white leading-tight ml-2">Smart Data Platform</h1>
                )}
              </div>
              {leftPanelState === 'open' && (
                <p className="text-sm md:text-base text-blue-100 leading-tight mt-1">Clustering Analytics Dashboard</p>
              )}
            </div>
            {leftPanelState === 'open' && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setLeftPanelState('minimized')}
                  className="p-1 text-white hover:bg-blue-700 rounded transition-colors"
                  title="Minimize panel"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {leftPanelState === 'open' && (
          <>
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
              {/* Data Configuration */}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Upload CSV/Excel</label>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  className="mt-1"
                />
                <input
                  type="text"
                  placeholder="Enter table name"
                  value={uploadedTable}
                  onChange={(e) => setUploadedTable(e.target.value)}
                  className="mt-2 px-3 py-2 border rounded w-full"
                />
                <button
                  onClick={handleUpload}
                  className="mt-2 bg-blue-600 text-white px-4 py-2 rounded"
                >
                  Upload
                </button>
              </div>


              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-gray-600" />
                  <h3 className="font-medium text-gray-900">Data Configuration</h3>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Table Name</label>
                  <select
                    value={formData.table_name}
                    onChange={(e) => {
                      handleInputChange('table_name', e.target.value);  // Corrected
                    }}
                    className="text-black w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm md:text-base bg-white"
                  >
                    <option value="">Select a table</option>
                    {availableTables.map((table) => (
                      <option key={table} value={table}>{table}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Features</label>

                    {availableFeatures.length === 0 ? (
                      <p className="text-sm text-gray-500">No numeric columns found for this table.</p>
                    ) : (
                      <>
                        {/* ✅ Replace checkboxes with this dropdown */}
                        <select
                          onChange={(e) => {
                            const selected = e.target.value;
                            if (selected && !formData.selected_features.includes(selected)) {
                              setFormData((prev) => ({
                                ...prev,
                                selected_features: [...prev.selected_features, selected]
                              }));
                              setSelectedDropdownValue(""); // Clear only after adding
                            }

                          }}
                          className="text-black w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
                          value={selectedDropdownValue}
                        >
                          <option value="" disabled>Select a feature...</option>
                          {availableFeatures
                            .filter((f) => !formData.selected_features.includes(f.name))
                            .map((feature) => (
                              <option key={feature.name} value={feature.name}>
                                {feature.name} ({feature.type})
                              </option>
                            ))}
                        </select>


                        {/* ✅ Chip display for selected features */}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {formData.selected_features.map((f) => {
                            const col = availableFeatures.find((c) => c.name === f);
                            return (
                              <span
                                key={f}
                                className="inline-flex items-center bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                              >
                                {f}{" "}
                                {col && (
                                  <span className="ml-1 text-xs text-blue-700 bg-white px-2 py-0.5 rounded">
                                    {col.type}
                                  </span>
                                )}
                                <button
                                  onClick={() =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      selected_features: prev.selected_features.filter((x) => x !== f)
                                    }))
                                  }
                                  className="ml-1 hover:text-red-500 bg-white"
                                >
                                  ×
                                </button>
                              </span>
                            );
                          })}

                        </div>
                      </>
                    )}
                  </div>

                </div>
              </div>

              {/* Algorithm Settings */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-gray-600" />
                  <h3 className="font-medium text-gray-900">Algorithm Settings</h3>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Algorithm</label>
                  <select
                    value={formData.algorithm}
                    onChange={(e) => handleInputChange('algorithm', e.target.value)}
                    className="text-black w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:border-transparent text-sm md:text-base bg-white"
                  >
                    <option value="">Select Algorithm</option>
                    <option value="kmeans" className="text-black">K-Means</option>
                    <option value="dbscan" className="text-black">DBSCAN</option>
                    <option value="hierarchical" className="text-black">Hierarchical</option>
                    <option value="meanshift" className="text-black">Mean Shift</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Normalization</label>
                  <select
                    value={formData.normalize}
                    onChange={(e) => handleInputChange('normalize', e.target.value)}
                    className="text-black w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm md:text-base bg-white"
                  >
                    <option value="">Select Normalization</option>
                    <option value="none" className="text-black">None</option>
                    <option value="standard" className="text-black">Standard</option>
                    <option value="minmax" className="text-black">Min-Max</option>
                    <option value="robust" className="text-black">Robust</option>
                    <option value="maxabs" className="text-black">Max Absolute</option>
                  </select>
                </div>

                {/* Conditional parameters based on algorithm */}
                {(formData.algorithm === 'kmeans' || formData.algorithm === 'hierarchical') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Number of Clusters</label>
                    <input
                      type="number"
                      value={formData.num_clusters}
                      onChange={(e) => handleInputChange('num_clusters', parseInt(e.target.value, 10))}
                      className="text-black w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm md:text-base bg-white"
                      min="2"
                      max="10"
                    />
                  </div>
                )}

                {formData.algorithm === 'dbscan' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Epsilon</label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.eps}
                        onChange={(e) => handleInputChange('eps', parseFloat(e.target.value))}
                        className="text-black w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm md:text-base bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Min Samples</label>
                      <input
                        type="number"
                        value={formData.min_samples}
                        onChange={(e) => handleInputChange('min_samples', parseInt(e.target.value, 10))}
                        className="text-black w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm md:text-base bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Run Button */}
            <div className="p-4 md:p-6 border-t border-gray-200">
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-4 rounded-md transition duration-200 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                ) : (
                  <Play className="w-4 h-4" />
                )}
                {loading ? 'Running Analysis...' : 'Run Analysis'}
              </button>
            </div>
          </>
        )}

        {leftPanelState === 'minimized' && (
          <div className="flex-1 flex flex-col items-center py-6 space-y-4">
            <button 
              onClick={() => setLeftPanelState('open')}
              className="p-3 text-white hover:text-gray-900 bg-blue-500 hover:bg-gray-100 rounded-lg transition-colors"
              title="Expand panel"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setLeftPanelState('open')}
              className="p-3 text-white hover:text-gray-900 bg-blue-500 hover:bg-gray-100 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setLeftPanelState('open')}
              className="p-3 text-white hover:text-gray-900 bg-blue-500 hover:bg-gray-100 rounded-lg transition-colors"
              title="Algorithm settings"
            >
              <BarChart3 className="w-5 h-5" />
            </button>
            <div className="flex-1 bg-gray-50 overflow-y-auto text-gray-900 p-6"></div>
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4">
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition duration-200"
                title="Run Analysis"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mx-auto"></div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <Play className="w-5 h-5" />
                    Run Analysis
                  </div>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Panel - Results */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-gray-200 p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-gray-900 truncate">Analysis Results</h2>
                <p className="text-sm text-gray-600">Clustering insights and visualizations</p>
              </div>
            </div>
            
            {/* Top Right Navigation */}
            <div className="flex items-center gap-2 md:gap-4 ml-4">
              <button className="p-2 text-white hover:text-gray-900 hover:bg-gray-100  bg-blue-500 rounded-lg transition-colors">
                <Settings className="w-5 h-5" />
              </button>
              
              <button className="p-2 text-white hover:text-gray-900 hover:bg-gray-100  bg-blue-500 rounded-lg transition-colors relative">
                <Bell className="w-5 h-5" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></div>
              </button>
              
              <div className="relative user-dropdown">
                <button 
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center px-3 py-2 text-white  hover:text-gray-900 hover:bg-gray-100 bg-blue-500 rounded"
                >
                  {/* <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div> */}
                  John Doe
                  <ChevronDown className="ml-1 w-4 h-4" />
                </button>
                
                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded shadow-md z-50">
                    <a href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Profile</a>
                    <a href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Settings</a>
                    <div className="border-t border-gray-100 my-1"></div>
                    <a href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Sign out</a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
              <strong>Error:</strong> {error}
            </div>
          )}

          {!results && !loading && !error && (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <div className="text-center">
                <Database className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                {!results && !loading && (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <div className="text-4xl mb-2">💾</div>
                      <p>
                        Configure your clustering parameters and click 
                        <strong> "Run Analysis"</strong> to see results
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {results && (
            <div className="space-y-6">
              {/* Cluster Summary Table */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-4 md:px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <Table className="w-5 h-5 text-gray-600" />
                    <h3 className="text-lg font-medium text-gray-900">Cluster Summary</h3>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Cluster ID
                        </th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Count
                        </th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {formData.selected_features[0]} (Centroid)
                        </th>
                        <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {formData.selected_features[1]} (Centroid)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {results.data.map((cluster, index) => (
                        <tr key={cluster.cluster_id} className="hover:bg-gray-50">
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div 
                                className="w-3 h-3 rounded-full mr-3"
                                style={{ backgroundColor: clusterColors[index % clusterColors.length] }}
                              ></div>
                              <span className="text-sm font-medium text-gray-900">
                                Cluster {cluster.cluster_id}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {cluster.count}
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {cluster.centroid[formData.selected_features[0]].toFixed(2)}
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {cluster.centroid[formData.selected_features[1]].toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Scatter Plot Visualization */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-4 md:px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-gray-600" />
                    <h3 className="text-lg font-medium text-gray-900">Cluster Visualization</h3>
                  </div>
                </div>
                <div className="p-4 md:p-6">
                  <ResponsiveContainer width="100%" height={isMobile ? 300 : 400}>
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        type="number" 
                        dataKey="x" 
                        name={formData.selected_features[0]}
                        label={{ value: formData.selected_features[0], position: 'insideBottom', offset: -10 }}
                        fontSize={isMobile ? 12 : 14}
                      />
                      <YAxis 
                        type="number" 
                        dataKey="y" 
                        name={formData.selected_features[1]}
                        label={{ value: formData.selected_features[1], angle: -90, position: 'insideLeft' }}
                        fontSize={isMobile ? 12 : 14}
                      />
                      <Tooltip 
                        cursor={{ strokeDasharray: '3 3' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white p-3 border border-gray-200 rounded-md shadow-lg">
                                <p className="font-medium">Cluster {data.cluster}</p>
                                <p className="text-sm text-gray-600">
                                  {formData.selected_features[0]}: {data.x}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {formData.selected_features[1]}: {data.y}
                                </p>

                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Scatter data={scatterData}>
                        {scatterData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={clusterColors[entry.cluster % clusterColors.length]} 
                          />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Optional: Display matplotlib image if available */}
              {results.chart_data?.image_base64 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                  <div className="px-4 md:px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Generated Plot</h3>
                  </div>
                  <div className="p-4 md:p-6">
                    <img 
                      src={`data:image/png;base64,${results.chart_data.image_base64}`}
                      alt="Clustering visualization"
                      className="max-w-full h-auto rounded-md"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Bottom Right Footer */}
        <div className="bg-white border-t border-gray-100 px-4 md:px-6 py-4">
          <div className="flex items-center justify-center md:justify-end gap-4 md:gap-6 text-xs md:text-sm text-gray-500">
            <a href="#" className="hover:text-gray-700 transition-colors">Help</a>
            <a href="#" className="hover:text-gray-700 transition-colors">Docs</a>
            <a href="#" className="hover:text-gray-700 transition-colors hidden md:inline">Privacy Policy</a>
            <a href="#" className="hover:text-gray-700 transition-colors hidden md:inline">Terms of Service</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClusteringDashboard;