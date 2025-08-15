import { DynamicMovieNetwork } from './lib/network.js';
import { TTSManager } from './lib/tts.js';
import * as api from './lib/api.js';
import * as ui from './lib/ui.js';
import { EdgeMouseNavigator } from './lib/mouseNav.js';

document.addEventListener('DOMContentLoaded', () => {
    if (typeof d3 === 'undefined') {
        console.error('D3.js failed to load from CDN');
        document.body.innerHTML += '<div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: red; color: white; padding: 20px; border-radius: 10px; z-index: 9999;">❌ D3.js failed to load. Check internet connection.</div>';
        return;
    }

    const network = new DynamicMovieNetwork();
    // Mouse-edge navigator for D3 zoom pan
    // Load mouse nav settings from localStorage or defaults
    const savedMouseNav = JSON.parse(localStorage.getItem('mouseNavSettings') || '{}');
    const mouseNavDefaults = {
        sensitivity: 0.06,
        smoothing: 0.2,
        maxDistance: 240,
        deadZone: 35,
        invertPanning: true,
        exponentialScaling: false,
        baseSpeed: 18
    };
    const mouseNavConfig = { ...mouseNavDefaults, ...savedMouseNav };

    const mouseNavigator = new EdgeMouseNavigator(network.svg, network.zoom, mouseNavConfig);
    const tts = new TTSManager();
    
    // Enhanced search functionality
    let searchTimeout;
    let recentSearches = JSON.parse(localStorage.getItem('recentSearches') || '[]');
    let isSearchDropdownOpen = false;
    let extractedMovies = []; // Initialize extractedMovies here

    function setupGlobalEventListeners() {
        // Enhanced search with debouncing and autocomplete
        const searchInput = document.getElementById('movieSearch');
        const searchBtn = document.getElementById('searchBtn');
        
        // Create search dropdown for autocomplete
        createSearchDropdown();
        
        searchBtn.addEventListener('click', () => network.searchAndAddMovie());
        
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            
            if (query.length >= 2) {
                searchTimeout = setTimeout(() => {
                    showSearchSuggestions(query);
                }, 300); // 300ms debounce
            } else {
                hideSearchDropdown();
            }
        });
        
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                hideSearchDropdown();
                network.searchAndAddMovie();
            }
        });
        
        searchInput.addEventListener('focus', () => {
            if (searchInput.value.trim().length >= 2) {
                showSearchSuggestions(searchInput.value.trim());
            } else {
                showRecentSearches();
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                hideSearchDropdown();
            }
        });

        document.getElementById('saveBtn').addEventListener('click', showSaveDialog);
        document.getElementById('loadBtn').addEventListener('click', showLoadDialog);
        document.getElementById('clearBtn').addEventListener('click', () => { network.clearNetwork(); updateEmptyOverlay(); });
        document.getElementById('centerBtn').addEventListener('click', () => network.centerNetwork());
        document.getElementById('labelsBtn').addEventListener('click', () => network.toggleLabels());

        // AI Provider Selector (async)
        setupAIProviderSelector().catch(console.error);

        // Mouse navigation toggle
        const mouseNavBtn = document.getElementById('mouseNavBtn');
        if (mouseNavBtn) {
            const settingsBtn = document.getElementById('mouseNavSettingsBtn');
            if (settingsBtn) {
                // Build settings popover lazily on first click
                let popoverEl = null;
                const ensureSettingsPopover = () => {
                    if (popoverEl) return popoverEl;
                    popoverEl = document.createElement('div');
                    popoverEl.id = 'mouseNavPopover';
                    popoverEl.style.cssText = `
                        position: fixed; top: 70px; right: 20px; z-index: 1500;
                        background: var(--glass-bg); color: var(--text-color);
                        border: 1px solid var(--glass-border); border-radius: 12px;
                        padding: 12px; width: 280px; box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                        backdrop-filter: blur(10px);
                    `;
                    popoverEl.innerHTML = `
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <strong>🖱️ Mouse Navigation</strong>
                            <button id="mouseNavClose" class="control-btn" style="padding:4px 8px;">✖</button>
                        </div>
                        <div style="display:grid; gap:10px; font-size:12px;">
                            <label> 
                                <div style="display:flex; justify-content:space-between;">
                                    <span>Sensitivity</span>
                                    <span id="mn_sensitivity_val"></span>
                                </div>
                                <input id="mn_sensitivity" type="range" min="0.01" max="0.3" step="0.01" />
                            </label>
                            <label>
                                <div style="display:flex; justify-content:space-between;">
                                    <span>Smoothing</span>
                                    <span id="mn_smoothing_val"></span>
                                </div>
                                <input id="mn_smoothing" type="range" min="0.05" max="0.9" step="0.05" />
                            </label>
                            <label>
                                <div style="display:flex; justify-content:space-between;">
                                    <span>Max Distance</span>
                                    <span id="mn_maxDistance_val"></span>
                                </div>
                                <input id="mn_maxDistance" type="range" min="100" max="600" step="10" />
                            </label>
                            <label>
                                <div style="display:flex; justify-content:space-between;">
                                    <span>Dead Zone</span>
                                    <span id="mn_deadZone_val"></span>
                                </div>
                                <input id="mn_deadZone" type="range" min="0" max="150" step="5" />
                            </label>
                            <label style="display:flex; align-items:center; gap:8px;">
                                <input id="mn_invert" type="checkbox" /> Invert Panning
                            </label>
                            <label style="display:flex; align-items:center; gap:8px;">
                                <input id="mn_exponential" type="checkbox" /> Exponential Scaling
                            </label>
                            <div style="display:flex; justify-content:space-between; gap:8px;">
                                <button id="mn_resetBtn" class="control-btn" style="flex:1;">Reset</button>
                                <button id="mn_closeBtn" class="control-btn" style="flex:1;">Close</button>
                            </div>
                            <div style="font-size:11px; color: var(--text-secondary);">Tip: Press Space to toggle Mouse Nav</div>
                        </div>
                    `;
                    document.body.appendChild(popoverEl);

                    // Wire inputs
                    const bindSlider = (id, key, formatter = (v)=>v) => {
                        const el = document.getElementById(id);
                        const label = document.getElementById(id + '_val');
                        el.value = mouseNavConfig[key];
                        label.textContent = formatter(mouseNavConfig[key]);
                        el.addEventListener('input', () => {
                            const val = parseFloat(el.value);
                            mouseNavConfig[key] = val;
                            mouseNavigator.setParams({ [key]: val });
                            label.textContent = formatter(val);
                            localStorage.setItem('mouseNavSettings', JSON.stringify(mouseNavConfig));
                        });
                    };

                    bindSlider('mn_sensitivity', 'sensitivity', v=>Number(v).toFixed(2));
                    bindSlider('mn_smoothing', 'smoothing', v=>Number(v).toFixed(2));
                    bindSlider('mn_maxDistance', 'maxDistance', v=>`${Math.round(v)}px`);
                    bindSlider('mn_deadZone', 'deadZone', v=>`${Math.round(v)}px`);

                    // Checkboxes
                    const invertEl = document.getElementById('mn_invert');
                    const expoEl = document.getElementById('mn_exponential');
                    invertEl.checked = !!mouseNavConfig.invertPanning;
                    expoEl.checked = !!mouseNavConfig.exponentialScaling;
                    invertEl.addEventListener('change',()=>{
                        mouseNavConfig.invertPanning = invertEl.checked;
                        mouseNavigator.setParams({ invertPanning: invertEl.checked });
                        localStorage.setItem('mouseNavSettings', JSON.stringify(mouseNavConfig));
                    });
                    expoEl.addEventListener('change',()=>{
                        mouseNavConfig.exponentialScaling = expoEl.checked;
                        mouseNavigator.setParams({ exponentialScaling: expoEl.checked });
                        localStorage.setItem('mouseNavSettings', JSON.stringify(mouseNavConfig));
                    });

                    // Buttons
                    const close = ()=> { popoverEl.style.display='none'; };
                    document.getElementById('mouseNavClose').addEventListener('click', close);
                    document.getElementById('mn_closeBtn').addEventListener('click', close);
                    document.getElementById('mn_resetBtn').addEventListener('click', ()=>{
                        Object.assign(mouseNavConfig, mouseNavDefaults);
                        mouseNavigator.setParams(mouseNavDefaults);
                        localStorage.setItem('mouseNavSettings', JSON.stringify(mouseNavConfig));
                        // Reset UI values
                        ['sensitivity','smoothing','maxDistance','deadZone'].forEach(k=>{
                            const sid = 'mn_' + k;
                            const el = document.getElementById(sid);
                            const label = document.getElementById(sid+'_val');
                            el.value = mouseNavDefaults[k];
                            label.textContent = ['sensitivity','smoothing'].includes(k) ? Number(mouseNavDefaults[k]).toFixed(2) : `${mouseNavDefaults[k]}px`;
                        });
                        invertEl.checked = mouseNavDefaults.invertPanning;
                        expoEl.checked = mouseNavDefaults.exponentialScaling;
                    });

                    // Click-away to close
                    setTimeout(()=>{
                        document.addEventListener('click', (ev)=>{
                            if (popoverEl.style.display !== 'none' && !popoverEl.contains(ev.target) && ev.target !== settingsBtn) {
                                popoverEl.style.display = 'none';
                            }
                        });
                    }, 0);
                    return popoverEl;
                };

                settingsBtn.addEventListener('click', (e)=>{
                    e.stopPropagation();
                    const el = ensureSettingsPopover();
                    el.style.display = (el.style.display === 'none' || !el.style.display) ? 'block' : 'none';
                });
            }
            let mouseNavEnabled = false;
            const updateMouseNavBtn = () => {
                mouseNavBtn.classList.toggle('active', mouseNavEnabled);
                mouseNavBtn.textContent = mouseNavEnabled ? '🖱️ Mouse Nav: On' : '🖱️ Mouse Nav: Off';
                mouseNavBtn.title = (mouseNavEnabled ? 'Disable mouse-edge navigation' : 'Enable mouse-edge navigation') + ' (Space)';
            };
            updateMouseNavBtn();
            const toggleMouseNav = () => {
                mouseNavEnabled = mouseNavigator.toggle();
                updateMouseNavBtn();
                ui.showNotification(mouseNavEnabled ? 'Mouse navigation enabled' : 'Mouse navigation disabled', mouseNavEnabled ? 'success' : 'info');
            };
            mouseNavBtn.addEventListener('click', toggleMouseNav);
            // Spacebar shortcut (when not typing in input/textarea)
            document.addEventListener('keydown', (e) => {
                const tag = (document.activeElement && document.activeElement.tagName) || '';
                if (e.code === 'Space' && tag !== 'INPUT' && tag !== 'TEXTAREA' && !e.isComposing) {
                    e.preventDefault();
                    toggleMouseNav();
                }
            });
        }

        // Listen for custom event to remove a node
        document.addEventListener('removeNode', (e) => {
            const nodeId = e.detail.nodeId;
            network.removeNode(nodeId);
            ui.showNotification('Movie removed from network', 'info');
        });
        
        // Color mode icon buttons
        document.querySelectorAll('.color-mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = btn.dataset.mode;
                
                // Update active state
                document.querySelectorAll('.color-mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Set color mode and update legend (preserves existing filters)
                network.setColorMode(mode);
                
                // Apply all category filters to maintain persistent filtering and update counts
                if (network.applyAllCategoryFilters) {
                    // Small delay to ensure the color mode is set first
                    setTimeout(() => {
                        network.applyAllCategoryFilters();
                    }, 50);
                }
                
                // Show/hide load details button based on data availability
                const dataAvailability = network.checkDataAvailability(mode);
                const loadDetailsBtn = document.getElementById('loadDetailsBtn');
                
                if (dataAvailability.missing > 0) {
                    loadDetailsBtn.style.display = 'inline-block';
                    loadDetailsBtn.textContent = `📄 Load ${dataAvailability.missing}`;
                    btn.classList.add('needs-data');
                } else {
                    loadDetailsBtn.style.display = 'none';
                    btn.classList.remove('needs-data');
                }
                
                // Update visual indicators for categories with active filters
                network.updateCategoryFilterIndicators();
            });
        });

        // Load details button
        document.getElementById('loadDetailsBtn').addEventListener('click', () => {
            network.loadMissingDetailsForColorMode();
        });

        // Sidebar toggle button
        document.getElementById('toggleColorSidebar').addEventListener('click', () => {
            const sidebar = document.getElementById('colorModeSidebar');
            const toggleBtn = document.getElementById('toggleColorSidebar');
            
            sidebar.classList.toggle('minimized');
            toggleBtn.textContent = sidebar.classList.contains('minimized') ? '+' : '−';
        });

        // Clear all filters button
        document.getElementById('clearAllFiltersBtn').addEventListener('click', () => {
            if (network && network.clearAllFiltersGlobal) {
                network.clearAllFiltersGlobal();
            }
        });

        // Add AI insights button if it exists
        const aiBtn = document.getElementById('aiBtn');
        if (aiBtn) {
            aiBtn.addEventListener('click', () => generateNetworkInsights());
        }

        // Add AI Chat button
        const aiChatBtn = document.createElement('button');
        aiChatBtn.id = 'aiChatBtn';
        aiChatBtn.className = 'control-btn';
        aiChatBtn.innerHTML = '💬 AI Chat';
        aiChatBtn.title = 'Chat with AI for recommendations';
        aiChatBtn.addEventListener('click', showChatModal);
        // Insert near aiBtn
        const controls = document.querySelector('.controls');
        if (controls) {
            controls.appendChild(aiChatBtn);
        }

        document.getElementById('closeSaveBtn').addEventListener('click', closeSaveDialog);
        document.getElementById('cancelSaveBtn').addEventListener('click', closeSaveDialog);
        document.getElementById('confirmSaveBtn').addEventListener('click', saveNetwork);
        document.getElementById('closeLoadBtn').addEventListener('click', closeLoadDialog);
        document.getElementById('cancelLoadBtn').addEventListener('click', closeLoadDialog);
        document.getElementById('refreshNetworksBtn').addEventListener('click', refreshNetworksList);

        window.addEventListener('click', (event) => {
            if (event.target === document.getElementById('saveModal')) closeSaveDialog();
            if (event.target === document.getElementById('loadModal')) closeLoadDialog();
        });

        document.addEventListener('click', (e) => {
            // Handle expand/collapse button
            if (e.target.closest('.expand-btn')) {
                e.stopPropagation();
                const expandBtn = e.target.closest('.expand-btn');
                const networkId = expandBtn.dataset.networkId;
                toggleNetworkExpansion(networkId);
                return;
            }

            // Handle delete button
            if (e.target.closest('.delete-btn')) {
                e.stopPropagation();
                const deleteBtn = e.target.closest('.delete-btn');
                const networkId = deleteBtn.dataset.networkId;
                deleteNetwork(networkId);
                return;
            }

            // Handle network item selection (only if not clicking on buttons)
            if (e.target.closest('.saved-network-item') && 
                !e.target.closest('.action-btn') && 
                !e.target.closest('.expand-btn') && 
                !e.target.closest('.delete-btn')) {
                const networkItem = e.target.closest('.saved-network-item');
                const networkId = networkItem.dataset.networkId;
                if (networkId) {
                    selectNetwork(networkId);
                }
            }

            // Handle action buttons
            if (e.target.closest('.action-btn')) {
                e.stopPropagation();
                const actionBtn = e.target.closest('.action-btn');
                const action = actionBtn.dataset.action;
                const networkId = actionBtn.dataset.networkId;
                
                if (action === 'load' && networkId) {
                    loadSelectedNetwork(networkId);
                } else if (action === 'export' && networkId) {
                    const format = actionBtn.dataset.format || 'json';
                    exportNetwork(networkId, format);
                } else if (action === 'preview' && networkId) {
                    previewNetwork(networkId);
                }
            }
        });
    }

    function showSaveDialog() {
        if (network.nodes.length === 0) {
            ui.showNotification('No network to save', 'error');
            return;
        }

        const modal = document.getElementById('saveModal');
        const preview = document.getElementById('savePreview');
        
        const totalMovies = network.nodes.length;
        const totalConnections = network.links.length;
        const seedMovie = network.nodes.find(n => n.depth === 0)?.title || 'Unknown';
        const genres = [...new Set(network.nodes.flatMap(n => {
            const details = n.fullDetails || n.basicDetails || {};
            return details.genres || [];
        }))];
        
        preview.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 13px;">
                <div><strong>Movies:</strong> ${totalMovies}</div>
                <div><strong>Connections:</strong> ${totalConnections}</div>
                <div><strong>Seed Movie:</strong> ${seedMovie}</div>
                <div><strong>Max Depth:</strong> ${Math.max(...network.nodes.map(n => n.depth))}</div>
            </div>
            ${genres.length > 0 ? `<div style="margin-top: 10px;"><strong>Genres:</strong> ${genres.slice(0, 5).join(', ')}${genres.length > 5 ? '...' : ''}</div>` : ''}
        `;
        
        const nameInput = document.getElementById('networkName');
        nameInput.value = seedMovie ? `${seedMovie} Network` : 'Movie Network';
        
        modal.style.display = 'flex';
        nameInput.focus();
    }

    function closeSaveDialog() {
        document.getElementById('saveModal').style.display = 'none';
    }

    async function saveNetwork() {
        const name = document.getElementById('networkName').value.trim();
        const description = document.getElementById('networkDescription').value.trim();
        
        if (!name) {
            ui.showNotification('Please enter a network name', 'error');
            return;
        }

        ui.showLoading(true);
        
        try {
            const networkData = {
                name: name,
                description: description,
                nodes: network.nodes,
                links: network.links.map(link => ({
                    source: typeof link.source === 'object' ? link.source.id : link.source,
                    target: typeof link.target === 'object' ? link.target.id : link.target
                })),
                settings: {
                    showLabels: network.showLabels,
                    colorScheme: 'default'
                },
                seedMovie: network.nodes.find(n => n.depth === 0)?.title || null
            };

            const result = await api.saveNetworkToServer(networkData);
            
            if (result.success) {
                ui.showNotification(`Network "${name}" saved successfully!`, 'success');
                closeSaveDialog();
                
                document.getElementById('networkName').value = '';
                document.getElementById('networkDescription').value = '';
            } else {
                ui.showNotification('Failed to save network', 'error');
            }
            
        } catch (error) {
            ui.showNotification('Failed to save network', 'error');
        } finally {
            ui.showLoading(false);
        }
    }

    async function showLoadDialog() {
        const modal = document.getElementById('loadModal');
        modal.style.display = 'flex';
        
        await refreshNetworksList();
    }

    function closeLoadDialog() {
        document.getElementById('loadModal').style.display = 'none';
    }

    async function refreshNetworksList() {
        const listContainer = document.getElementById('savedNetworksList');
        listContainer.innerHTML = '<div style="text-align: center; padding: 20px;">Loading saved networks...</div>';
        
        try {
            const networks = await api.getSavedNetworks();
            
            if (networks.length === 0) {
                listContainer.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                        <div style="font-size: 48px; margin-bottom: 15px;">📂</div>
                        <div>No saved networks found</div>
                        <div style="font-size: 12px; margin-top: 8px;">Create and save a network to see it here</div>
                    </div>
                `;
                return;
            }
            
            listContainer.innerHTML = networks.map(net => {
                const createdDate = new Date(net.createdAt).toLocaleDateString();
                const createdTime = new Date(net.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                return `
                    <div class="saved-network-item" data-network-id="${net.id}">
                        <div class="network-item-header">
                            <div class="network-item-title-row">
                                <button class="expand-btn" data-network-id="${net.id}" title="Expand/Collapse Details">
                                    <span class="expand-icon">▶</span>
                                </button>
                                <div class="network-item-title">${net.name}</div>
                                <button class="delete-btn" data-action="delete" data-network-id="${net.id}" title="Delete Network">
                                    🗑️
                                </button>
                            </div>
                            <div class="network-item-date">${createdDate} ${createdTime}</div>
                        </div>
                        <div class="network-item-content" style="display: none;">
                            ${net.description ? `<div class="network-item-description">${net.description}</div>` : ''}
                            <div class="network-item-stats">
                                <span>🎬 ${net.metadata.totalMovies} movies</span>
                                <span>🔗 ${net.metadata.totalConnections} connections</span>
                                <span>⭐ ${net.metadata.averageRating || 'N/A'}</span>
                                <span>📊 Depth ${net.metadata.maxDepth}</span>
                                ${net.metadata.genres ? `<span>🎭 ${net.metadata.genres.length} genres</span>` : ''}
                            </div>
                            <div class="network-item-actions">
                                <button class="action-btn" data-action="load" data-network-id="${net.id}">📂 Load</button>
                                <button class="action-btn" data-action="export" data-network-id="${net.id}" data-format="json">📤 Export</button>
                                <button class="action-btn" data-action="preview" data-network-id="${net.id}">👁️ Preview</button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
        } catch (error) {
            listContainer.innerHTML = `
                <div style="text-align: center; padding: 20px; color: var(--accent-color);">
                    Failed to load saved networks
                </div>
            `;
        }
    }

    let selectedNetworkId = null;

    function selectNetwork(networkId) {
        document.querySelectorAll('.saved-network-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        event.currentTarget.classList.add('selected');
        selectedNetworkId = networkId;
    }

    async function loadSelectedNetwork(networkId) {
        ui.showLoading(true);
        
        try {
            const networkData = await api.loadNetworkFromServer(networkId);
            network.loadNetworkData(networkData);
            if (window.updateEmptyOverlay) window.updateEmptyOverlay();
            
            ui.showNotification(`Network "${networkData.name}" loaded successfully!`, 'success');
            closeLoadDialog();
            
        } catch (error) {
            ui.showNotification('Failed to load network', 'error');
        } finally {
            ui.showLoading(false);
        }
    }

    async function deleteNetwork(networkId) {
        if (!confirm('Are you sure you want to delete this network? This action cannot be undone.')) {
            return;
        }
        
        try {
            await api.deleteNetworkFromServer(networkId);
            ui.showNotification('Network deleted successfully', 'success');
            refreshNetworksList();
            
        } catch (error) {
            ui.showNotification('Failed to delete network', 'error');
        }
    }

    async function exportNetwork(networkId, format) {
        const success = await api.exportNetwork(networkId, format);
        if (success) {
            ui.showNotification(`Network exported as ${format.toUpperCase()}`, 'success');
        } else {
            ui.showNotification('Failed to export network', 'error');
        }
    }

    function toggleNetworkExpansion(networkId) {
        const networkItem = document.querySelector(`[data-network-id="${networkId}"]`);
        if (!networkItem) return;

        const content = networkItem.querySelector('.network-item-content');
        const expandIcon = networkItem.querySelector('.expand-icon');
        
        if (content.style.display === 'none') {
            // Expand
            content.style.display = 'block';
            expandIcon.textContent = '▼';
            networkItem.classList.add('expanded');
        } else {
            // Collapse
            content.style.display = 'none';
            expandIcon.textContent = '▶';
            networkItem.classList.remove('expanded');
        }
    }

    async function previewNetwork(networkId) {
        try {
            const networkData = await api.loadNetworkFromServer(networkId);
            showNetworkPreview(networkData);
        } catch (error) {
            ui.showNotification('Failed to load network preview', 'error');
        }
    }

    function showNetworkPreview(networkData) {
        // Create preview modal if it doesn't exist
        let modal = document.getElementById('networkPreviewModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'networkPreviewModal';
            modal.className = 'modal';
            modal.style.display = 'none';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3>📊 Network Preview</h3>
                        <button class="close-btn" id="closePreviewBtn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div id="previewContent"></div>
                    </div>
                    <div class="modal-footer">
                        <button class="control-btn" id="loadFromPreviewBtn">📂 Load Network</button>
                        <button class="control-btn" id="closePreviewFooterBtn">Close</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        // Generate preview content
        const topMovies = networkData.nodes
            .filter(node => node.fullDetails?.rating)
            .sort((a, b) => (b.fullDetails.rating || 0) - (a.fullDetails.rating || 0))
            .slice(0, 5);

        const genres = [...new Set(networkData.nodes.flatMap(node => 
            node.fullDetails?.genres || node.basicDetails?.genres || []
        ))];

        document.getElementById('previewContent').innerHTML = `
            <div style="margin-bottom: 20px;">
                <h4 style="color: var(--gemini-accent); margin-bottom: 10px;">${networkData.name}</h4>
                ${networkData.description ? `<p style="color: var(--text-secondary); margin-bottom: 15px;">${networkData.description}</p>` : ''}
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                    <div><strong>🎬 Movies:</strong> ${networkData.metadata?.totalMovies || networkData.nodes.length}</div>
                    <div><strong>🔗 Connections:</strong> ${networkData.metadata?.totalConnections || networkData.links?.length || 0}</div>
                    <div><strong>📊 Max Depth:</strong> ${networkData.metadata?.maxDepth || Math.max(...networkData.nodes.map(n => n.depth || 0))}</div>
                    <div><strong>⭐ Avg Rating:</strong> ${networkData.metadata?.averageRating || 'N/A'}</div>
                </div>

                ${topMovies.length > 0 ? `
                    <div style="margin-bottom: 20px;">
                        <h5 style="color: var(--accent-color); margin-bottom: 10px;">🏆 Top Rated Movies</h5>
                        <div style="max-height: 150px; overflow-y: auto;">
                            ${topMovies.map(movie => `
                                <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid var(--glass-border);">
                                    <span>${movie.title} (${movie.year})</span>
                                    <span style="color: var(--gemini-accent);">⭐ ${movie.fullDetails.rating.toFixed(1)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                ${genres.length > 0 ? `
                    <div>
                        <h5 style="color: var(--accent-color); margin-bottom: 10px;">🎭 Genres (${genres.length})</h5>
                        <div style="display: flex; flex-wrap: wrap; gap: 5px;">
                            ${genres.slice(0, 10).map(genre => 
                                `<span style="background: var(--glass-bg); padding: 3px 8px; border-radius: 10px; font-size: 12px;">${genre}</span>`
                            ).join('')}
                            ${genres.length > 10 ? `<span style="color: var(--text-secondary); font-size: 12px;">+${genres.length - 10} more</span>` : ''}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
        
        modal.style.display = 'flex';
        
        // Add event listeners
        document.getElementById('closePreviewBtn').onclick = () => modal.style.display = 'none';
        document.getElementById('closePreviewFooterBtn').onclick = () => modal.style.display = 'none';
        document.getElementById('loadFromPreviewBtn').onclick = () => {
            modal.style.display = 'none';
            network.loadNetworkData(networkData);
            ui.showNotification(`Network "${networkData.name}" loaded successfully!`, 'success');
            closeLoadDialog();
        };
    }

    // Enhanced search functions
    function createSearchDropdown() {
        const searchContainer = document.querySelector('.search-container');
        const dropdown = document.createElement('div');
        dropdown.id = 'searchDropdown';
        dropdown.className = 'search-dropdown';
        dropdown.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: var(--glass-bg);
            backdrop-filter: blur(10px);
            border: 1px solid var(--glass-border);
            border-radius: 15px;
            margin-top: 5px;
            max-height: 400px;
            overflow-y: auto;
            z-index: 1001;
            display: none;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        `;
        searchContainer.appendChild(dropdown);
    }

    async function showSearchSuggestions(query) {
        const dropdown = document.getElementById('searchDropdown');
        dropdown.innerHTML = '<div style="padding: 15px; text-align: center;">Searching...</div>';
        // show recent below loader
        if (recentSearches.length) {
            dropdown.innerHTML += `
                <div style="padding: 8px 15px; border-top: 1px solid var(--glass-border); color: var(--text-secondary); font-size: 11px;">Recent</div>
                ${recentSearches.slice(0,3).map(s=>`<div class="recent-search-item">🕒 ${s}</div>`).join('')}
            `;
        }
        dropdown.style.display = 'block';
        isSearchDropdownOpen = true;

        try {
            const results = await api.searchMovie(query);
            if (results) {
                displaySearchResults([results], query);
            } else {
                dropdown.innerHTML = '<div style="padding: 15px; text-align: center; color: var(--text-secondary);">No movies found</div>';
            }
        } catch (error) {
            dropdown.innerHTML = '<div style="padding: 15px; text-align: center; color: var(--accent-color);">Search failed</div>';
        }
    }

    function displaySearchResults(results, query) {
        const dropdown = document.getElementById('searchDropdown');
        
        const resultsHtml = results.map(movie => {
            const poster = (movie.images?.poster?.thumb) ? movie.images.poster.thumb : (movie.poster_path ? `https://image.tmdb.org/t/p/w92${movie.poster_path}` : '');
            return `
            <div class="search-result-item" data-movie-id="${movie.ids.trakt}" style="display:flex; align-items:center; gap:10px;">
                ${poster ? `<img src="${poster}" alt="${movie.title}" width="36" height="54" style="object-fit:cover; border-radius:6px;" onerror="this.style.display='none'"/>` : ''}
                <div style="flex:1; min-width:0;">
                    <div class="movie-title" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${highlightQuery(movie.title, query)}</div>
                    <div class="movie-meta">${movie.year || ''} ${movie.genres ? '• ' + movie.genres.slice(0, 2).join(', ') : ''}</div>
                </div>
                <button class="control-btn" data-action="add" style="padding:6px 10px;">Add</button>
            </div>`;
        }).join('');

        dropdown.innerHTML = `
            <div style="padding: 10px 15px; border-bottom: 1px solid var(--glass-border); font-weight: bold; color: var(--gemini-accent);">
                Search Results
            </div>
            ${resultsHtml}
        `;

        // Add click handlers
        dropdown.querySelectorAll('.search-result-item').forEach(item => {
            // Click on the whole item selects
            item.addEventListener('click', (e) => {
                if (e.target.closest('button[data-action="add"]')) return; // handled below
                const movieId = item.dataset.movieId;
                const title = item.querySelector('.movie-title')?.textContent?.replace(/\s+Add$/, '') || '';
                selectMovieFromSearch(title);
                hideSearchDropdown();
            });
            // Explicit add button
            const addBtn = item.querySelector('button[data-action="add"]');
            if (addBtn) {
                addBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const title = item.querySelector('.movie-title')?.textContent?.replace(/\s+Add$/, '') || '';
                    selectMovieFromSearch(title);
                    hideSearchDropdown();
                });
            }
        });
    }

    function showRecentSearches() {
        if (recentSearches.length === 0) return;
        
        const dropdown = document.getElementById('searchDropdown');
        const recentHtml = recentSearches.slice(0, 5).map(search => `
            <div class="recent-search-item">
                🕒 ${search}
            </div>
        `).join('');

        dropdown.innerHTML = `
            <div style="padding: 10px 15px; border-bottom: 1px solid var(--glass-border); font-weight: bold; color: var(--gemini-accent);">
                Recent Searches
            </div>
            ${recentHtml}
        `;
        dropdown.style.display = 'block';
        isSearchDropdownOpen = true;

        // Add click handlers
        dropdown.querySelectorAll('.recent-search-item').forEach(item => {
            item.addEventListener('click', () => {
                const searchText = item.textContent.replace('🕒 ', '');
                document.getElementById('movieSearch').value = searchText;
                hideSearchDropdown();
                network.searchAndAddMovie();
            });
        });
    }

    function hideSearchDropdown() {
        const dropdown = document.getElementById('searchDropdown');
        dropdown.style.display = 'none';
        isSearchDropdownOpen = false;
    }

    function highlightQuery(text, query) {
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<mark style="background: var(--gemini-accent); color: var(--primary-color); padding: 1px 3px; border-radius: 3px;">$1</mark>');
    }

    function selectMovieFromSearch(title) {
        // Add to recent searches
        recentSearches = recentSearches.filter(search => search !== title);
        recentSearches.unshift(title);
        recentSearches = recentSearches.slice(0, 5);
        localStorage.setItem('recentSearches', JSON.stringify(recentSearches));
        
        // Set search input and trigger search
        document.getElementById('movieSearch').value = title;
        network.searchAndAddMovie();
    }

    // Enhanced save dialog with better preview
    function showSaveDialog() {
        if (network.nodes.length === 0) {
            ui.showNotification('No network to save', 'error');
            return;
        }

        const modal = document.getElementById('saveModal');
        const preview = document.getElementById('savePreview');
        
        const totalMovies = network.nodes.length;
        const totalConnections = network.links.length;
        const seedMovie = network.nodes.find(n => n.depth === 0)?.title || 'Unknown';
        const maxDepth = Math.max(...network.nodes.map(n => n.depth));
        
        // Calculate average rating
        const ratingsSum = network.nodes.reduce((sum, node) => {
            const rating = node.fullDetails?.rating || node.basicDetails?.rating || 0;
            return sum + rating;
        }, 0);
        const avgRating = totalMovies > 0 ? (ratingsSum / totalMovies).toFixed(1) : 'N/A';
        
        // Get unique genres
        const genres = [...new Set(network.nodes.flatMap(n => {
            const details = n.fullDetails || n.basicDetails || {};
            return details.genres || [];
        }))];
        
        preview.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 13px; margin-bottom: 15px;">
                <div><strong>🎬 Movies:</strong> ${totalMovies}</div>
                <div><strong>🔗 Connections:</strong> ${totalConnections}</div>
                <div><strong>🎯 Seed Movie:</strong> ${seedMovie}</div>
                <div><strong>📊 Max Depth:</strong> ${maxDepth}</div>
                <div><strong>⭐ Avg Rating:</strong> ${avgRating}</div>
                <div><strong>🎭 Genres:</strong> ${genres.length}</div>
            </div>
            ${genres.length > 0 ? `
                <div style="margin-top: 10px;">
                    <strong>Top Genres:</strong> 
                    <div style="margin-top: 5px;">
                        ${genres.slice(0, 5).map(genre => 
                            `<span style="background: var(--glass-bg); padding: 2px 8px; border-radius: 10px; font-size: 11px; margin-right: 5px; display: inline-block; margin-bottom: 3px;">${genre}</span>`
                        ).join('')}
                        ${genres.length > 5 ? `<span style="color: var(--text-secondary); font-size: 11px;">+${genres.length - 5} more</span>` : ''}
                    </div>
                </div>
            ` : ''}
        `;
        
        const nameInput = document.getElementById('networkName');
        nameInput.value = seedMovie ? `${seedMovie} Network` : 'Movie Network';
        
        modal.style.display = 'flex';
        nameInput.focus();
    }

    // Enhanced network save with metadata
    async function saveNetwork() {
        const name = document.getElementById('networkName').value.trim();
        const description = document.getElementById('networkDescription').value.trim();
        
        if (!name) {
            ui.showNotification('Please enter a network name', 'error');
            return;
        }

        ui.showLoading(true);
        
        try {
            // Calculate enhanced metadata
            const totalMovies = network.nodes.length;
            const totalConnections = network.links.length;
            const maxDepth = Math.max(...network.nodes.map(n => n.depth));
            
            const ratingsSum = network.nodes.reduce((sum, node) => {
                const rating = node.fullDetails?.rating || node.basicDetails?.rating || 0;
                return sum + rating;
            }, 0);
            const averageRating = totalMovies > 0 ? (ratingsSum / totalMovies).toFixed(1) : 'N/A';
            
            const networkData = {
                name: name,
                description: description,
                nodes: network.nodes,
                links: network.links.map(link => ({
                    source: typeof link.source === 'object' ? link.source.id : link.source,
                    target: typeof link.target === 'object' ? link.target.id : link.target
                })),
                settings: {
                    showLabels: network.showLabels,
                    colorScheme: 'default'
                },
                seedMovie: network.nodes.find(n => n.depth === 0)?.title || null,
                metadata: {
                    totalMovies,
                    totalConnections,
                    maxDepth,
                    averageRating,
                    createdAt: new Date().toISOString(),
                    nodeCount: totalMovies,
                    linkCount: totalConnections
                }
            };

            // Check if network with same name exists
            let existingNetworks = [];
            try {
                existingNetworks = await api.getSavedNetworks();
            } catch (e) {
                console.log('Could not check existing networks');
            }
            
            const existingNetwork = existingNetworks.find(net => net.name === name);
            let result;
            
            if (existingNetwork) {
                // Network exists, update it
                console.log(`📝 Network "${name}" exists, updating...`);
                result = await api.updateNetworkOnServer(existingNetwork.id, networkData);
                ui.showNotification(`Network "${name}" updated successfully!`, 'success');
            } else {
                // New network, create it
                console.log(`📝 Creating new network "${name}"`);
                result = await api.saveNetworkToServer(networkData);
                ui.showNotification(`Network "${name}" saved successfully!`, 'success');
            }
            
            if (result.success) {
                closeSaveDialog();
                
                document.getElementById('networkName').value = '';
                document.getElementById('networkDescription').value = '';
            } else {
                ui.showNotification('Failed to save network', 'error');
            }
            
        } catch (error) {
            ui.showNotification('Failed to save network', 'error');
        } finally {
            ui.showLoading(false);
        }
    }

    // AI Integration Features
    async function generateNetworkInsights(useStreaming = false) {
        if (network.nodes.length === 0) {
            ui.showNotification('No network to analyze', 'error');
            return;
        }

        ui.showLoading(true);
        try {
            const networkData = {
                nodes: network.nodes,
                links: network.links
            };
            
            if (useStreaming) {
                // Show modal first with streaming indicator
                showAIInsightsModal('', true); // true = streaming mode
                
                let accumulatedText = '';
                await api.streamNetworkAnalysis(
                    networkData,
                    (token) => {
                        // onDelta: append token to modal
                        accumulatedText += token;
                        updateAIInsightsContent(accumulatedText, false).catch(console.error); // false = still streaming
                    },
                    (finalText) => {
                        // onDone: mark as complete
                        updateAIInsightsContent(finalText || accumulatedText, true).catch(console.error); // true = done
                        ui.showNotification('AI analysis complete!', 'success');
                    },
                    (error) => {
                        // onError
                        updateAIInsightsContent('Streaming failed: ' + error.message, true).catch(console.error);
                        ui.showNotification('AI streaming failed: ' + error.message, 'error');
                    }
                );
            } else {
                // Original non-streaming approach
                const analysis = await api.generateNetworkAnalysis(networkData);
                showAIInsightsModal(analysis);
                ui.showNotification('AI analysis generated!', 'success');
            }
        } catch (error) {
            if (error.message.includes('AI service not available')) {
                ui.showNotification('AI features require an AI provider to be configured on the server.', 'error');
                console.log('💡 To enable AI features:');
                console.log('1. Get API key from https://makersuite.google.com/app/apikey');
                console.log('2. Add GEMINI_API_KEY=your_key to .env file');
                console.log('3. Restart the server');
            } else if (error.message.includes('quota exceeded')) {
                ui.showNotification('AI quota exceeded. You have reached the daily limit of 50 free requests. Try again tomorrow!', 'warning');
                console.log('💡 Gemini API Free Tier Limits:');
                console.log('• 50 requests per day');
                console.log('• Resets every 24 hours');
                console.log('• Consider upgrading for higher limits: https://ai.google.dev/pricing');
            } else {
                ui.showNotification('Failed to generate AI insights: ' + error.message, 'error');
            }
        } finally {
            ui.showLoading(false);
        }
    }

    function showAIInsightsModal(analysis, streaming = false) {
        // Create AI insights modal if it doesn't exist
        let modal = document.getElementById('aiInsightsModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'aiInsightsModal';
            modal.className = 'modal';
            modal.style.display = 'none';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>🤖 AI Network Analysis</h3>
                        <button class="close-btn" id="closeAiInsightsBtn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div id="aiAnalysisContent" style="line-height: 1.6; color: var(--text-color);"></div>
                    </div>
                    <div class="modal-footer">
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <button class="control-btn" id="ai-insights-tts-listen-btn" style="background: var(--accent-color); border: none; color: white; padding: 8px 12px; border-radius: 6px; font-size: 14px; cursor: pointer;">
                                🔊 Listen to Analysis
                            </button>
                            <button class="control-btn" id="ai-insights-tts-stop-btn" style="background: var(--glass-bg); border: 1px solid var(--glass-border); color: white; padding: 8px 12px; border-radius: 6px; font-size: 14px; cursor: pointer;">
                                ⏹️ Stop Audio
                            </button>
                        </div>
                        <button class="control-btn" id="closeAiInsightsFooterBtn">Close</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        updateAIInsightsContent(analysis, !streaming).catch(console.error);
        
        modal.style.display = 'flex';
        
        // Add event listeners for close buttons
        const closeBtn = document.getElementById('closeAiInsightsBtn');
        const closeFooterBtn = document.getElementById('closeAiInsightsFooterBtn');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }
        
        if (closeFooterBtn) {
            closeFooterBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        // Add TTS button event listeners for AI insights (remove existing first to prevent duplicates)
        const aiInsightsTtsListenBtn = document.getElementById('ai-insights-tts-listen-btn');
        const aiInsightsTtsStopBtn = document.getElementById('ai-insights-tts-stop-btn');

        if (aiInsightsTtsListenBtn) {
            // Remove any existing event listeners by cloning the element
            const newListenBtn = aiInsightsTtsListenBtn.cloneNode(true);
            aiInsightsTtsListenBtn.parentNode.replaceChild(newListenBtn, aiInsightsTtsListenBtn);
            
            newListenBtn.addEventListener('click', async () => {
                try {
                    // Better text extraction - get all text content from the analysis
                    const analysisContainer = document.getElementById('aiAnalysisContent');
                    if (!analysisContainer) {
                        ui.showNotification('No AI analysis content found', 'error');
                        return;
                    }
                    
                    // Extract text from the analysis paragraph, handling multiple possible structures
                    let insightsText = '';
                    const paragraph = analysisContainer.querySelector('p');
                    if (paragraph) {
                        insightsText = paragraph.textContent || paragraph.innerText || '';
                    } else {
                        // Fallback: get all text content
                        insightsText = analysisContainer.textContent || analysisContainer.innerText || '';
                    }
                    
                    // Clean up the text
                    insightsText = insightsText.trim();
                    
                    // Remove any "No analysis generated" or loading messages
                    if (insightsText.includes('No analysis generated') || 
                        insightsText.includes('Generating analysis') || 
                        insightsText.includes('Loading') ||
                        insightsText.length < 10) {
                        ui.showNotification('No AI analysis available to read', 'warning');
                        return;
                    }
                    
                    // Show loading state
                    ui.showNotification('🔊 Starting AI insights audio...', 'info');
                    newListenBtn.disabled = true;
                    newListenBtn.textContent = '🔊 Loading...';
                    
                    if (window.playAIInsights) {
                        await window.playAIInsights(insightsText);
                        ui.showNotification('🎵 AI insights audio playback started', 'success');
                    } else {
                        ui.showNotification('TTS function not available', 'error');
                    }
                } catch (error) {
                    console.error('AI Insights TTS Error:', error);
                    ui.showNotification(`TTS Error: ${error.message}`, 'error');
                } finally {
                    // Reset button state
                    newListenBtn.disabled = false;
                    newListenBtn.textContent = '🔊 Listen';
                }
            });
        }

        if (aiInsightsTtsStopBtn) {
            // Remove any existing event listeners by cloning the element
            const newStopBtn = aiInsightsTtsStopBtn.cloneNode(true);
            aiInsightsTtsStopBtn.parentNode.replaceChild(newStopBtn, aiInsightsTtsStopBtn);
            
            newStopBtn.addEventListener('click', () => {
                try {
                    if (window.stopTTS) {
                        window.stopTTS();
                        ui.showNotification('⏹️ Audio stopped', 'info');
                        
                        // Reset listen button state if it exists
                        const currentListenBtn = document.getElementById('ai-insights-tts-listen-btn');
                        if (currentListenBtn) {
                            currentListenBtn.disabled = false;
                            currentListenBtn.textContent = '🔊 Listen';
                        }
                    } else {
                        ui.showNotification('TTS stop function not available', 'error');
                    }
                } catch (error) {
                    console.error('TTS Stop Error:', error);
                    ui.showNotification('Error stopping audio', 'error');
                }
            });
        }
    }

    function showChatModal() {
        let modal = document.getElementById('aiChatModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'aiChatModal';
            modal.className = 'modal';
            modal.style.display = 'none';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 500px; height: 80vh; display: flex; flex-direction: column;">
                    <div class="modal-header">
                        <h3>💬 AI Chat</h3>
                        <button class="close-btn" id="closeAiChatBtn">&times;</button>
                    </div>
                    <div class="modal-body" style="flex-grow: 1; overflow-y: auto; padding: 15px; background: var(--background-color-dark); border-radius: 8px; margin-bottom: 10px;">
                        <div id="chatMessages" style="display: flex; flex-direction: column; gap: 10px;">
                            <!-- Chat messages will be appended here -->
                            <div class="chat-message ai-message">
                                <div class="message-bubble">Hello! How can I help you with movie recommendations today?</div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer" style="padding-top: 0;">
                        <div style="display: flex; width: 100%; gap: 10px;">
                            <input type="text" id="chatInput" placeholder="Type your message..." style="flex-grow: 1; padding: 10px; border-radius: 8px; border: 1px solid var(--glass-border); background: var(--input-bg); color: var(--text-color);">
                            <button class="control-btn" id="sendChatBtn" style="padding: 10px 15px; background: var(--accent-color); color: white; border-radius: 8px; border: none;">Send</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            // Event listeners for close buttons
            document.getElementById('closeAiChatBtn').addEventListener('click', () => {
                modal.style.display = 'none';
            });

            // Chat logic
            const chatInput = document.getElementById('chatInput');
            const sendChatBtn = document.getElementById('sendChatBtn');
            const chatMessagesContainer = document.getElementById('chatMessages');

            if (sendChatBtn && chatInput && chatMessagesContainer) {
                sendChatBtn.addEventListener('click', sendMessage);
                chatInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        sendMessage();
                    }
                });
            }
        }
        modal.style.display = 'flex';
        document.getElementById('chatInput').focus();
    }

    async function updateAIInsightsContent(text, isDone = true) {
        // Create AI insights modal if it doesn't exist
        let modal = document.getElementById('aiInsightsModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'aiInsightsModal';
            modal.className = 'modal';
            modal.style.display = 'none';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>🤖 AI Network Analysis</h3>
                        <button class="close-btn" id="closeAiInsightsBtn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div id="aiAnalysisContent" style="line-height: 1.6; color: var(--text-color);"></div>
                    </div>
                    <div class="modal-footer">
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <button class="control-btn" id="ai-insights-tts-listen-btn" style="background: var(--accent-color); border: none; color: white; padding: 8px 12px; border-radius: 6px; font-size: 14px; cursor: pointer;">
                                🔊 Listen to Analysis
                            </button>
                            <button class="control-btn" id="ai-insights-tts-stop-btn" style="background: var(--glass-bg); border: 1px solid var(--glass-border); color: white; padding: 8px 12px; border-radius: 6px; font-size: 14px; cursor: pointer;">
                                ⏹️ Stop Audio
                            </button>
                        </div>
                        <button class="control-btn" id="closeAiInsightsFooterBtn">Close</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        updateAIInsightsContent(analysis, !streaming).catch(console.error);
        
        modal.style.display = 'flex';
        
        // Add event listeners for close buttons
        const closeBtn = document.getElementById('closeAiInsightsBtn');
        const closeFooterBtn = document.getElementById('closeAiInsightsFooterBtn');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }
        
        if (closeFooterBtn) {
            closeFooterBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        // Add TTS button event listeners for AI insights (remove existing first to prevent duplicates)
        const aiInsightsTtsListenBtn = document.getElementById('ai-insights-tts-listen-btn');
        const aiInsightsTtsStopBtn = document.getElementById('ai-insights-tts-stop-btn');

        if (aiInsightsTtsListenBtn) {
            // Remove any existing event listeners by cloning the element
            const newListenBtn = aiInsightsTtsListenBtn.cloneNode(true);
            aiInsightsTtsListenBtn.parentNode.replaceChild(newListenBtn, aiInsightsTtsListenBtn);
            
            newListenBtn.addEventListener('click', async () => {
                try {
                    // Better text extraction - get all text content from the analysis
                    const analysisContainer = document.getElementById('aiAnalysisContent');
                    if (!analysisContainer) {
                        ui.showNotification('No AI analysis content found', 'error');
                        return;
                    }
                    
                    // Extract text from the analysis paragraph, handling multiple possible structures
                    let insightsText = '';
                    const paragraph = analysisContainer.querySelector('p');
                    if (paragraph) {
                        insightsText = paragraph.textContent || paragraph.innerText || '';
                    } else {
                        // Fallback: get all text content
                        insightsText = analysisContainer.textContent || analysisContainer.innerText || '';
                    }
                    
                    // Clean up the text
                    insightsText = insightsText.trim();
                    
                    // Remove any "No analysis generated" or loading messages
                    if (insightsText.includes('No analysis generated') || 
                        insightsText.includes('Generating analysis') || 
                        insightsText.includes('Loading') ||
                        insightsText.length < 10) {
                        ui.showNotification('No AI analysis available to read', 'warning');
                        return;
                    }
                    
                    // Show loading state
                    ui.showNotification('🔊 Starting AI insights audio...', 'info');
                    newListenBtn.disabled = true;
                    newListenBtn.textContent = '🔊 Loading...';
                    
                    if (window.playAIInsights) {
                        await window.playAIInsights(insightsText);
                        ui.showNotification('🎵 AI insights audio playback started', 'success');
                    } else {
                        ui.showNotification('TTS function not available', 'error');
                    }
                } catch (error) {
                    console.error('AI Insights TTS Error:', error);
                    ui.showNotification(`TTS Error: ${error.message}`, 'error');
                } finally {
                    // Reset button state
                    newListenBtn.disabled = false;
                    newListenBtn.textContent = '🔊 Listen';
                }
            });
        }

        if (aiInsightsTtsStopBtn) {
            // Remove any existing event listeners by cloning the element
            const newStopBtn = aiInsightsTtsStopBtn.cloneNode(true);
            aiInsightsTtsStopBtn.parentNode.replaceChild(newStopBtn, aiInsightsTtsStopBtn);
            
            newStopBtn.addEventListener('click', () => {
                try {
                    if (window.stopTTS) {
                        window.stopTTS();
                        ui.showNotification('⏹️ Audio stopped', 'info');
                        
                        // Reset listen button state if it exists
                        const currentListenBtn = document.getElementById('ai-insights-tts-listen-btn');
                        if (currentListenBtn) {
                            currentListenBtn.disabled = false;
                            currentListenBtn.textContent = '🔊 Listen';
                        }
                    } else {
                        ui.showNotification('TTS stop function not available', 'error');
                    }
                } catch (error) {
                    console.error('TTS Stop Error:', error);
                    ui.showNotification('Error stopping audio', 'error');
                }
            });
        }
    }

    async function updateAIInsightsContent(text, isDone = true) {
        const content = document.getElementById('aiAnalysisContent');
        if (!content) return;
        
        const streamingIndicator = isDone ? '' : '<span style="color: var(--gemini-accent); animation: pulse 1.5s infinite;">●</span>';
        
        // Get current provider info
        let providerText = 'AI Provider';
        try {
            const response = await api.getAIProviders();
            if (response.currentProvider && response.currentProvider.enabled) {
                providerText = response.currentProvider.displayName;
            }
        } catch (error) {
            console.log('Could not get provider info:', error);
        }
        
        content.innerHTML = `
            <div style="background: var(--glass-bg); padding: 15px; border-radius: 10px; border-left: 4px solid var(--gemini-accent);">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                    <span style="font-size: 20px;">🤖</span>
                    <strong style="color: var(--gemini-accent);">AI Analysis</strong>
                    ${streamingIndicator}
                </div>
                <p style="margin: 0; white-space: pre-wrap;">${text || (isDone ? 'No analysis generated.' : 'Generating analysis...')}</p>
            </div>
            <div style="margin-top: 15px; font-size: 12px; color: var(--text-secondary); text-align: center;">
                Powered by ${providerText}
            </div>
        `;
    }

    // AI Provider selector
    async function addAIProviderSelector() {
        const controls = document.querySelector('.controls');
        if (!controls || document.getElementById('aiProviderSelect')) return;

        // Get current provider
        const providerInfo = await api.getAIProvider();
        
        const selectorContainer = document.createElement('div');
        selectorContainer.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-left: 10px;';
        
        const label = document.createElement('span');
        label.textContent = 'AI:';
        label.style.cssText = 'font-size: 12px; color: var(--text-secondary);';
        
        const select = document.createElement('select');
        select.id = 'aiProviderSelect';
        select.style.cssText = 'padding: 4px 8px; border: 1px solid var(--glass-border); background: var(--glass-bg); color: var(--text-color); border-radius: 4px; font-size: 12px;';
        
        const options = [
            { value: '', text: 'Auto' },
            { value: 'gemini', text: 'Gemini' },
            { value: 'openai', text: 'OpenAI' },
            { value: 'groq', text: 'Groq' }
        ];
        
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.text;
            if (opt.value === providerInfo.provider) option.selected = true;
            select.appendChild(option);
        });
        
        select.addEventListener('change', async () => {
            const newProvider = select.value;
            ui.showLoading(true);
            try {
                const result = await api.setAIProvider(newProvider || 'auto');
                if (result.success) {
                    ui.showNotification(`AI provider switched to ${result.provider}`, 'success');
                    // Refresh AI button state
                    setTimeout(() => checkAIServiceAvailabilityAndAddButton(), 500);
                } else {
                    ui.showNotification(`Failed to switch provider: ${result.error}`, 'error');
                    // Revert selection
                    select.value = providerInfo.provider || '';
                }
            } catch (error) {
                ui.showNotification(`Provider switch error: ${error.message}`, 'error');
                select.value = providerInfo.provider || '';
            } finally {
                ui.showLoading(false);
            }
        });
        
        selectorContainer.appendChild(label);
        selectorContainer.appendChild(select);
        
        // Insert near the AI button or at the end of controls
        const aiBtn = document.getElementById('aiBtn');
        if (aiBtn) {
            controls.insertBefore(selectorContainer, aiBtn.nextSibling);
        } else {
            controls.appendChild(selectorContainer);
        }
    }

    // Enhanced movie details with AI synopsis
    async function enhanceMovieWithAI(node) {
        if (!node.fullDetails?.overview) return;
        
        try {
            const synopsis = await api.generateMovieSynopsis(node.title, node.fullDetails.overview);
            node.aiSynopsis = synopsis;
            ui.updateSidebar(network.nodes); // Refresh sidebar to show AI synopsis
        } catch (error) {
            console.log('AI synopsis not available:', error.message);
        }
    }

    // Check AI availability on startup
    async function checkAIAvailability() {
        try {
            const health = await api.checkAIHealth();
            if (health.status === 'healthy') {
                console.log('✅ AI features available');
                addAIButton(true); // AI is working
            } else {
                console.log('⚠️ AI features not available:', health.reason);
                addAIButton(false, health.reason); // AI not working, show grayed out
            }
        } catch (error) {
            console.log('❌ AI service check failed');
            addAIButton(false, 'AI service unavailable'); // Show grayed out with error
        }
    }

    function addAIButton(isHealthy = true, reason = '') {
        const controls = document.querySelector('.controls');
        if (controls && !document.getElementById('aiBtn')) {
            console.log('🔧 Adding AI button to controls');
            const aiBtn = document.createElement('button');
            aiBtn.id = 'aiBtn';
            aiBtn.className = 'control-btn';
            aiBtn.innerHTML = '🤖 AI Insights';
            
            if (isHealthy) {
                // AI is working - normal button
                aiBtn.title = 'Generate AI analysis of your network (streaming)';
                aiBtn.addEventListener('click', () => generateNetworkInsights(true)); // enable streaming
            } else {
                // AI not working - grayed out button
                aiBtn.style.opacity = '0.5';
                aiBtn.style.cursor = 'not-allowed';
                aiBtn.style.filter = 'grayscale(1)';
                
                // Set helpful tooltip based on reason
                let tooltip = 'AI features unavailable';
                if (reason.includes('quota') || reason.includes('429')) {
                    tooltip = 'AI quota exceeded - Try again tomorrow or upgrade plan';
                } else if (reason.includes('API key') || reason.includes('key not configured')) {
                    tooltip = 'AI requires Gemini API key configuration';
                } else {
                    tooltip = `AI unavailable: ${reason}`;
                }
                aiBtn.title = tooltip;
                
                // Show helpful message when clicked
                aiBtn.addEventListener('click', () => {
                    if (reason.includes('quota') || reason.includes('429')) {
                        ui.showNotification('AI quota exceeded. You have reached the daily limit. Try again tomorrow!', 'warning');
                    } else if (reason.includes('API key') || reason.includes('key not configured')) {
                        ui.showNotification('AI requires Gemini API key. Check server configuration.', 'error');
                    } else {
                        ui.showNotification(`AI features unavailable: ${reason}`, 'error');
                    }
                });
            }
            
            // Insert before the color mode select to maintain order
            // Just append the AI button to controls since color mode is now in sidebar
            controls.appendChild(aiBtn);
            console.log('✅ AI button appended to controls');
        } else if (!controls) {
            console.log('❌ Controls container not found');
        } else {
            console.log('ℹ️ AI button already exists');
        }
    }

    // Global TTS functions for onclick handlers
    window.playMovieOverview = async (title, overview) => {
        try {
            ui.showNotification('🔊 Starting audio...', 'info');
            await tts.playMovieOverview(title, overview);
            ui.showNotification('🎵 Audio playback started', 'success');
        } catch (error) {
            console.error('TTS Error:', error);
            ui.showNotification(`Audio failed: ${error.message}`, 'error');
        }
    };

    window.stopTTS = () => {
        tts.stop();
        ui.showNotification('⏹️ Audio stopped', 'info');
    };

    window.playAIInsights = async (insightsText) => {
        try {
            if (!insightsText || insightsText.trim().length === 0) {
                ui.showNotification('No AI insights text to read', 'warning');
                return;
            }
            
            // Clean and prepare the text
            const cleanText = insightsText.trim();
            
            // Check if TTS is available
            if (!tts.isAvailable) {
                ui.showNotification('TTS service not available', 'error');
                return;
            }
            
            console.log('🔊 Playing AI insights:', cleanText.substring(0, 100) + '...');
            await tts.playAIInsights(cleanText);
            
        } catch (error) {
            console.error('AI Insights TTS Error:', error);
            
            // Provide more specific error messages
            let errorMessage = 'AI insights TTS failed';
            if (error.message.includes('not available')) {
                errorMessage = 'TTS service not available';
            } else if (error.message.includes('synthesis failed')) {
                errorMessage = 'Audio synthesis failed';
            } else if (error.message.includes('playback failed')) {
                errorMessage = 'Audio playback failed';
            } else {
                errorMessage = `TTS Error: ${error.message}`;
            }
            
            ui.showNotification(errorMessage, 'error');
        }
    };

    // AI Provider Selector Setup
    async function setupAIProviderSelector() {
        const selector = document.getElementById('aiProviderSelector');
        if (!selector) return;

        try {
            // Load available providers
            const response = await api.getAIProviders();
            const { providers, currentProvider } = response;

            // Clear loading option
            selector.innerHTML = '';

            // Add providers to selector
            providers.forEach(provider => {
                const option = document.createElement('option');
                option.value = provider.name;
                option.textContent = `${provider.displayName} ${provider.enabled ? '✅' : '❌'}`;
                option.disabled = !provider.enabled;
                
                if (currentProvider && currentProvider.name === provider.name) {
                    option.selected = true;
                }
                
                selector.appendChild(option);
            });

            // Add "No AI" option
            const noAiOption = document.createElement('option');
            noAiOption.value = '';
            noAiOption.textContent = '🚫 No AI';
            if (!currentProvider || !currentProvider.enabled) {
                noAiOption.selected = true;
            }
            selector.appendChild(noAiOption);

            // Handle provider change
            selector.addEventListener('change', async (e) => {
                const selectedProvider = e.target.value;
                
                if (!selectedProvider) {
                    // User selected "No AI"
                    ui.showNotification('AI features disabled', 'info');
                    return;
                }

                try {
                    ui.showNotification('Switching AI provider...', 'info');
                    const result = await api.setAIProvider(selectedProvider);
                    
                    if (result.success) {
                        ui.showNotification(`AI provider switched to ${result.provider}`, 'success');
                        
                        // Update the selector to reflect the change
                        const options = selector.querySelectorAll('option');
                        options.forEach(option => {
                            if (option.value === selectedProvider) {
                                option.selected = true;
                            }
                        });
                    } else {
                        ui.showNotification(`Failed to switch provider: ${result.details}`, 'error');
                        // Revert selection
                        setupAIProviderSelector();
                    }
                } catch (error) {
                    console.error('Error switching AI provider:', error);
                    ui.showNotification(`Error switching provider: ${error.message}`, 'error');
                    // Revert selection
                    setupAIProviderSelector();
                }
            });

            // Update selector title with current status
            if (currentProvider && currentProvider.enabled) {
                selector.title = `Current: ${currentProvider.displayName} (${currentProvider.model})`;
            } else {
                selector.title = 'No AI provider configured';
            }

        } catch (error) {
            console.error('Error setting up AI provider selector:', error);
            selector.innerHTML = '<option value="">🚫 AI Error</option>';
            selector.title = 'Error loading AI providers';
        }
    }

    // Global chat history
    let chatHistory = [{ 
        role: 'system', 
        content: `You are a movie recommendation expert. When providing movie recommendations:

1. Always include the release year in parentheses after the movie title
2. Format recommendations as numbered lists or tables when possible
3. Use this format: "Movie Title (Year)" or in tables with Title and Year columns
4. Be specific about why movies are recommended
5. Consider themes, genres, directors, and actors when making connections
6. If asked about childhood trauma movies, focus on films that handle the subject thoughtfully

Example formats:
- "The Pursuit of Happyness (2006)"
- "Room (2015)" 
- Tables with | Title | Year | columns

Always be helpful and provide detailed explanations for your recommendations.` 
    }];

    // Chat logic
    const chatInput = document.getElementById('chatInput');
    const sendChatBtn = document.getElementById('sendChatBtn');
    const chatMessagesContainer = document.getElementById('chatMessages');

    if (sendChatBtn && chatInput && chatMessagesContainer) {
        sendChatBtn.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }

    function formatMarkdownToHtml(markdownText) {
        let html = markdownText;

        // Convert bold: **text**
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // Convert italics: *text*
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // Convert headings: # Heading, ## Subheading, ### Sub-subheading
        html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');

        // Convert lists: - item
        // This is a basic conversion and assumes list items are on new lines
        const listItems = html.match(/^- (.*$)/gm);
        if (listItems) {
            let ulHtml = '<ul>';
            listItems.forEach(item => {
                ulHtml += `<li>${item.substring(2).trim()}</li>`;
            });
            ulHtml += '</ul>';
            html = html.replace(/^- (.*$)/gm, '').replace(/\n\n+/g, '\n'); // Remove original list lines and extra newlines
            html = html.replace(listItems[0], ulHtml); // Replace the first list item with the full ul
        }

        // Convert horizontal rule: ---
        html = html.replace(/^---\s*$/gm, '<hr>');

        // Convert multiple newlines to paragraphs, but avoid wrapping existing block-level elements
        html = html.split('\n\n').map(paragraph => {
            if (paragraph.trim() === '' || paragraph.startsWith('<h') || paragraph.startsWith('<ul') || paragraph.startsWith('<hr>')) {
                return paragraph;
            }
            return `<p>${paragraph.trim()}</p>`;
        }).join('');

        // Clean up any remaining single newlines within paragraphs
        html = html.replace(/\n/g, ' ');

        return html;
    }

    function displayMessage(role, content) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message', `${role}-message`);
        if (role === 'ai') {
            messageElement.innerHTML = `<div class="message-bubble">${formatMarkdownToHtml(content)}</div>`;
        } else {
            messageElement.innerHTML = `<div class="message-bubble">${content}</div>`; // For user messages, just display as is
        }
        document.getElementById('chatMessages').appendChild(messageElement); // Changed
        document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight; // Changed
    }

    async function sendMessage() {
        const userMessage = document.getElementById('chatInput').value.trim();
        if (userMessage === '') return;

        displayMessage('user', userMessage);
        document.getElementById('chatInput').value = '';

        chatHistory.push({ role: 'user', content: userMessage });

        ui.showLoading(true);

        try {
            const response = await api.sendChatMessage(chatHistory);
            const aiResponse = response.response;

            // --- Enhanced movie extraction from AI response ---
            extractedMovies = []; // Clear previous extractions
            
            // Method 1: Extract from markdown tables
            const tableRegex = /\|\s*#\s*\|\s*(?:Title|Film)\s*\|\s*Year\s*\|[\s\S]*?\n\|[-\s|]*\|\s*\n([\s\S]*?)(?=\n\n|\n---|\n\|(?!\s*\d)|\n[A-Z]|\n\*|$)/i;
            const tableMatch = aiResponse.match(tableRegex);
            
            if (tableMatch && tableMatch[1]) {
                const tableRows = tableMatch[1].trim().split('\n');
                tableRows.forEach(row => {
                    const cells = row.split('|').map(c => c.trim()).filter(c => c !== '');
                    if (cells.length >= 3) {
                        const title = cells[1].replace(/\*\*/g, '').trim(); // Remove markdown bold
                        const yearMatch = cells[2].match(/(\d{4})/);
                        const year = yearMatch ? yearMatch[1] : null;
                        if (title && year && !title.match(/^(Title|Film|Movie)$/i)) {
                            extractedMovies.push({ title, year });
                        }
                    }
                });
            }
            
            // Method 2: Extract from numbered lists with years
            const listRegex = /^\d+\.\s*(.+?)\s*\((\d{4})\)/gm;
            let listMatch;
            while ((listMatch = listRegex.exec(aiResponse)) !== null) {
                const title = listMatch[1].replace(/\*\*/g, '').trim();
                const year = listMatch[2];
                if (title && year) {
                    extractedMovies.push({ title, year });
                }
            }
            
            // Method 3: Extract from bullet points with years
            const bulletRegex = /^[-*]\s*(.+?)\s*\((\d{4})\)/gm;
            let bulletMatch;
            while ((bulletMatch = bulletRegex.exec(aiResponse)) !== null) {
                const title = bulletMatch[1].replace(/\*\*/g, '').trim();
                const year = bulletMatch[2];
                if (title && year) {
                    extractedMovies.push({ title, year });
                }
            }
            
            // Method 4: Extract movie titles in quotes with years
            const quotedRegex = /"([^"]+)"\s*\((\d{4})\)/g;
            let quotedMatch;
            while ((quotedMatch = quotedRegex.exec(aiResponse)) !== null) {
                const title = quotedMatch[1].trim();
                const year = quotedMatch[2];
                if (title && year) {
                    extractedMovies.push({ title, year });
                }
            }
            
            // Remove duplicates
            const uniqueMovies = [];
            const seen = new Set();
            extractedMovies.forEach(movie => {
                const key = `${movie.title.toLowerCase()}-${movie.year}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueMovies.push(movie);
                }
            });
            extractedMovies = uniqueMovies;
            
            console.log(`🎬 Extracted ${extractedMovies.length} movies from AI response:`, extractedMovies);
            // --- End enhanced movie extraction ---

            displayMessage('ai', aiResponse); // Pass raw response to displayMessage

            // Add "Add to Network" button if movies were extracted
            if (extractedMovies.length > 0) {
                const messageBubble = document.getElementById('chatMessages').lastChild.querySelector('.message-bubble');
                if (messageBubble) {
                    // Create a container for the extracted movies preview
                    const moviesContainer = document.createElement('div');
                    moviesContainer.style.cssText = `
                        margin-top: 15px;
                        padding: 12px;
                        background: rgba(233, 69, 96, 0.1);
                        border-radius: 8px;
                        border-left: 4px solid var(--accent-color);
                    `;
                    
                    const moviesTitle = document.createElement('div');
                    moviesTitle.textContent = `🎬 Found ${extractedMovies.length} movies:`;
                    moviesTitle.style.cssText = `
                        font-weight: bold;
                        color: var(--accent-color);
                        margin-bottom: 8px;
                        font-size: 14px;
                    `;
                    moviesContainer.appendChild(moviesTitle);
                    
                    // Show preview of movies (max 5)
                    const moviesList = document.createElement('div');
                    moviesList.style.cssText = `
                        font-size: 12px;
                        color: var(--text-secondary);
                        margin-bottom: 10px;
                        max-height: 100px;
                        overflow-y: auto;
                    `;
                    
                    const moviesToShow = extractedMovies.slice(0, 5);
                    moviesToShow.forEach(movie => {
                        const movieItem = document.createElement('div');
                        movieItem.textContent = `• ${movie.title} (${movie.year})`;
                        movieItem.style.marginBottom = '2px';
                        moviesList.appendChild(movieItem);
                    });
                    
                    if (extractedMovies.length > 5) {
                        const moreText = document.createElement('div');
                        moreText.textContent = `... and ${extractedMovies.length - 5} more`;
                        moreText.style.fontStyle = 'italic';
                        moviesList.appendChild(moreText);
                    }
                    
                    moviesContainer.appendChild(moviesList);
                    
                    // Add buttons container
                    const buttonsContainer = document.createElement('div');
                    buttonsContainer.style.cssText = 'display: flex; gap: 8px; align-items: center;';
                    
                    const addButton = document.createElement('button');
                    addButton.classList.add('control-btn', 'add-to-network-btn');
                    addButton.textContent = `➕ Add ${extractedMovies.length} Movies`;
                    addButton.style.cssText = `
                        background: var(--accent-color);
                        color: white;
                        border: none;
                        padding: 8px 12px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 12px;
                        flex: 1;
                    `;
                    addButton.addEventListener('click', addSuggestedMoviesToNetwork);
                    
                    const previewButton = document.createElement('button');
                    previewButton.classList.add('control-btn');
                    previewButton.textContent = '👁️ Preview';
                    previewButton.style.cssText = `
                        background: var(--glass-bg);
                        color: var(--text-color);
                        border: 1px solid var(--glass-border);
                        padding: 8px 12px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 12px;
                    `;
                    previewButton.addEventListener('click', () => showMoviePreview(extractedMovies));
                    
                    buttonsContainer.appendChild(addButton);
                    buttonsContainer.appendChild(previewButton);
                    moviesContainer.appendChild(buttonsContainer);
                    
                    messageBubble.appendChild(moviesContainer);
                }
            }

            chatHistory.push({ role: 'assistant', content: aiResponse });
        } catch (error) {
            console.error('AI Chat Error:', error);
            displayMessage('ai', 'Sorry, I am having trouble connecting to the AI. Please try again later.');
        } finally {
            ui.showLoading(false);
        }
    }

    function showMoviePreview(movies) {
        let modal = document.getElementById('moviePreviewModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'moviePreviewModal';
            modal.className = 'modal';
            modal.style.display = 'none';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3>🎬 Movie Preview</h3>
                        <button class="close-btn" id="closeMoviePreviewBtn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div id="moviePreviewContent"></div>
                    </div>
                    <div class="modal-footer">
                        <button class="control-btn" id="addAllMoviesBtn">➕ Add All to Network</button>
                        <button class="control-btn" id="closeMoviePreviewFooterBtn">Close</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        const content = document.getElementById('moviePreviewContent');
        content.innerHTML = `
            <div style="margin-bottom: 20px;">
                <p style="color: var(--text-secondary); margin-bottom: 15px;">
                    Preview of ${movies.length} movies extracted from the AI recommendation:
                </p>
                <div style="max-height: 400px; overflow-y: auto;">
                    ${movies.map((movie, index) => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid var(--glass-border); ${index % 2 === 0 ? 'background: rgba(255,255,255,0.02);' : ''}">
                            <div>
                                <div style="font-weight: bold; color: var(--text-color);">${movie.title}</div>
                                <div style="font-size: 12px; color: var(--text-secondary);">Year: ${movie.year}</div>
                            </div>
                            <button class="control-btn add-single-movie-btn" data-title="${movie.title}" data-year="${movie.year}" 
                                    style="background: var(--accent-color); color: white; border: none; padding: 6px 10px; border-radius: 4px; font-size: 11px;">
                                Add
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        modal.style.display = 'flex';

        // Event listeners
        document.getElementById('closeMoviePreviewBtn').onclick = () => modal.style.display = 'none';
        document.getElementById('closeMoviePreviewFooterBtn').onclick = () => modal.style.display = 'none';
        document.getElementById('addAllMoviesBtn').onclick = () => {
            modal.style.display = 'none';
            addSuggestedMoviesToNetwork();
        };

        // Individual movie add buttons
        document.querySelectorAll('.add-single-movie-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const title = e.target.dataset.title;
                const year = e.target.dataset.year;
                
                e.target.disabled = true;
                e.target.textContent = 'Adding...';
                
                try {
                    document.getElementById('movieSearch').value = `${title} ${year}`;
                    await network.searchAndAddMovie();
                    e.target.textContent = '✓ Added';
                    e.target.style.background = 'var(--success-color)';
                    ui.showNotification(`Added "${title}" to network`, 'success');
                } catch (error) {
                    e.target.textContent = '✗ Failed';
                    e.target.style.background = 'var(--accent-color)';
                    ui.showNotification(`Failed to add "${title}"`, 'error');
                }
            });
        });
    }

    async function addSuggestedMoviesToNetwork() {
        if (extractedMovies.length === 0) {
            ui.showNotification('No movies to add.', 'warning');
            return;
        }

        ui.showLoading(true);
        ui.showNotification(`Adding ${extractedMovies.length} movies to network...`, 'info');

        let addedCount = 0;
        for (const movie of extractedMovies) {
            try {
                document.getElementById('movieSearch').value = `${movie.title} ${movie.year}`;
                await network.searchAndAddMovie();
                addedCount++;
                // Add a small delay to prevent overwhelming the API/UI
                await new Promise(resolve => setTimeout(resolve, 800));
            } catch (error) {
                console.error(`Failed to add ${movie.title}:`, error);
            }
        }

        ui.showNotification(`Successfully added ${addedCount}/${extractedMovies.length} movies to network!`, 'success');
        ui.showLoading(false);
        
        // Update the empty overlay
        if (window.updateEmptyOverlay) window.updateEmptyOverlay();
    }

    setupGlobalEventListeners();
    checkAIAvailability(); // Check if AI features are available

    // Build Quick Help flyout
    (function setupQuickHelp(){
        const helpBtn = document.getElementById('helpBtn');
        if (!helpBtn) return;
        let panel = null;
        const ensurePanel = () => {
            if (panel) return panel;
            panel = document.createElement('div');
            panel.id = 'quickHelpPanel';
            panel.style.cssText = `
                position: fixed; top: 120px; right: 20px; z-index: 1400;
                width: 320px; max-height: 70vh; overflow: auto;
                background: var(--glass-bg); color: var(--text-color);
                border: 1px solid var(--glass-border); border-radius: 14px;
                padding: 14px; box-shadow: 0 8px 32px rgba(0,0,0,0.35);
                backdrop-filter: blur(10px); display: none;
            `;
            panel.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <strong>❓ Quick Help</strong>
                    <button id="qhClose" class="control-btn" style="padding:4px 8px;">✖</button>
                </div>
                <div style="font-size: 12px; line-height: 1.5; display: grid; gap: 10px;">
                    <div>
                        <div style="color: var(--gemini-accent); font-weight: 600;">Shortcuts</div>
                        <ul style="margin: 6px 0 0 16px;">
                            <li>Space: Toggle Mouse Navigation</li>
                            <li>C: Center network</li>
                            <li>L: Toggle labels</li>
                            <li>Ctrl/Cmd + Click or Double-click: Expand node</li>
                            <li>Scroll: Zoom</li>
                        </ul>
                    </div>
                    <div>
                        <div style="color: var(--gemini-accent); font-weight: 600;">Tips</div>
                        <ul style="margin: 6px 0 0 16px;">
                            <li>Use the color sidebar to highlight by depth, genre, year, etc.</li>
                            <li>Hover movies in the list to highlight them in the network.</li>
                            <li>Save your network and export it for later.</li>
                        </ul>
                    </div>
                    <div>
                        <div style="color: var(--gemini-accent); font-weight: 600;">AI & TTS</div>
                        <ul style="margin: 6px 0 0 16px;">
                            <li>AI Insights analyzes your current network (Gemini API required).</li>
                            <li>Open a movie to listen to its overview with TTS.</li>
                        </ul>
                    </div>
                </div>
            `;
            document.body.appendChild(panel);
            document.getElementById('qhClose').addEventListener('click', ()=> panel.style.display='none');
            setTimeout(()=>{
                document.addEventListener('click', (ev)=>{
                    if (panel.style.display !== 'none' && !panel.contains(ev.target) && ev.target !== helpBtn) {
                        panel.style.display = 'none';
                    }
                });
            }, 0);
            // Keyboard helpers
            document.addEventListener('keydown', (e)=>{
                if (e.key.toLowerCase() === 'c') {
                    network.centerNetwork();
                }
                if (e.key.toLowerCase() === 'l') {
                    network.toggleLabels();
                }
            });
            return panel;
        };
        helpBtn.addEventListener('click', (e)=>{
            e.stopPropagation();
            const p = ensurePanel();
            p.style.display = (p.style.display === 'none' || !p.style.display) ? 'block' : 'none';
        });
    })();
    
    // Empty overlay helper
    window.updateEmptyOverlay = function updateEmptyOverlay(){
        const overlay = document.getElementById('emptyOverlay');
        if (!overlay) return;
        const isEmpty = (network.nodes?.length || 0) === 0;
        overlay.style.display = isEmpty ? 'flex' : 'none';
    };
    window.updateEmptyOverlay();

    // Initialize the color sidebar with default mode
    if (network) {
        network.currentColorMode = 'depth'; // Ensure the mode is set
        network.updateColorLegend('depth'); // Initialize with depth mode
    }
});