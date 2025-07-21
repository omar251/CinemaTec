import { DynamicMovieNetwork } from './lib/network.js';
import * as api from './lib/api.js';
import * as ui from './lib/ui.js';

document.addEventListener('DOMContentLoaded', () => {
    if (typeof d3 === 'undefined') {
        console.error('D3.js failed to load from CDN');
        document.body.innerHTML += '<div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: red; color: white; padding: 20px; border-radius: 10px; z-index: 9999;">❌ D3.js failed to load. Check internet connection.</div>';
        return;
    }

    const network = new DynamicMovieNetwork();
    
    // Enhanced search functionality
    let searchTimeout;
    let recentSearches = JSON.parse(localStorage.getItem('recentSearches') || '[]');
    let isSearchDropdownOpen = false;

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
        document.getElementById('clearBtn').addEventListener('click', () => network.clearNetwork());
        document.getElementById('centerBtn').addEventListener('click', () => network.centerNetwork());
        document.getElementById('labelsBtn').addEventListener('click', () => network.toggleLabels());

        // Add AI insights button if it exists
        const aiBtn = document.getElementById('aiBtn');
        if (aiBtn) {
            aiBtn.addEventListener('click', () => generateNetworkInsights());
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
            if (e.target.closest('.saved-network-item') && !e.target.closest('.action-btn')) {
                const networkItem = e.target.closest('.saved-network-item');
                const networkId = networkItem.dataset.networkId;
                if (networkId) {
                    selectNetwork(networkId);
                }
            }

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
                } else if (action === 'delete' && networkId) {
                    deleteNetwork(networkId);
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
                            <div class="network-item-title">${net.name}</div>
                            <div class="network-item-date">${createdDate} ${createdTime}</div>
                        </div>
                        ${net.description ? `<div class="network-item-description">${net.description}</div>` : ''}
                        <div class="network-item-stats">
                            <span>🎬 ${net.metadata.totalMovies} movies</span>
                            <span>🔗 ${net.metadata.totalConnections} connections</span>
                            <span>⭐ ${net.metadata.averageRating || 'N/A'}</span>
                            <span>📊 Depth ${net.metadata.maxDepth}</span>
                        </div>
                        <div class.network-item-actions">
                            <button class="action-btn" data-action="load" data-network-id="${net.id}">📂 Load</button>
                            <button class="action-btn" data-action="export" data-network-id="${net.id}" data-format="json">📤 Export</button>
                            <button class="action-btn danger" data-action="delete" data-network-id="${net.id}">🗑️ Delete</button>
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
            z-index: 1000;
            display: none;
        `;
        searchContainer.appendChild(dropdown);
    }

    async function showSearchSuggestions(query) {
        const dropdown = document.getElementById('searchDropdown');
        dropdown.innerHTML = '<div style="padding: 15px; text-align: center;">Searching...</div>';
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
        
        const resultsHtml = results.map(movie => `
            <div class="search-result-item" data-movie-id="${movie.ids.trakt}">
                <div class="movie-title">${highlightQuery(movie.title, query)}</div>
                <div class="movie-meta">
                    ${movie.year} ${movie.genres ? '• ' + movie.genres.slice(0, 2).join(', ') : ''}
                </div>
            </div>
        `).join('');

        dropdown.innerHTML = `
            <div style="padding: 10px 15px; border-bottom: 1px solid var(--glass-border); font-weight: bold; color: var(--gemini-accent);">
                Search Results
            </div>
            ${resultsHtml}
        `;

        // Add click handlers
        dropdown.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const movieId = item.dataset.movieId;
                const title = item.querySelector('div').textContent;
                selectMovieFromSearch(title);
                hideSearchDropdown();
            });
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

    // AI Integration Features
    async function generateNetworkInsights() {
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
            
            const analysis = await api.generateNetworkAnalysis(networkData);
            showAIInsightsModal(analysis);
            ui.showNotification('AI analysis generated!', 'success');
        } catch (error) {
            if (error.message.includes('AI service not available')) {
                ui.showNotification('AI features require Gemini API key', 'error');
            } else {
                ui.showNotification('Failed to generate AI insights', 'error');
            }
        } finally {
            ui.showLoading(false);
        }
    }

    function showAIInsightsModal(analysis) {
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
                        <button class="control-btn" id="closeAiInsightsFooterBtn">Close</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        document.getElementById('aiAnalysisContent').innerHTML = `
            <div style="background: var(--glass-bg); padding: 15px; border-radius: 10px; border-left: 4px solid var(--gemini-accent);">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                    <span style="font-size: 20px;">🤖</span>
                    <strong style="color: var(--gemini-accent);">AI Analysis</strong>
                </div>
                <p style="margin: 0; white-space: pre-wrap;">${analysis}</p>
            </div>
            <div style="margin-top: 15px; font-size: 12px; color: var(--text-secondary); text-align: center;">
                Powered by Google Gemini AI
            </div>
        `;
        
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
                // Add AI button to header if not exists
                addAIButton();
            } else {
                console.log('⚠️ AI features not available:', health.reason);
            }
        } catch (error) {
            console.log('❌ AI service check failed');
        }
    }

    function addAIButton() {
        const controls = document.querySelector('.controls');
        if (controls && !document.getElementById('aiBtn')) {
            const aiBtn = document.createElement('button');
            aiBtn.id = 'aiBtn';
            aiBtn.className = 'control-btn';
            aiBtn.innerHTML = '🤖 AI Insights';
            aiBtn.title = 'Generate AI analysis of your network';
            controls.appendChild(aiBtn);
            
            aiBtn.addEventListener('click', () => generateNetworkInsights());
        }
    }

    setupGlobalEventListeners();
    checkAIAvailability(); // Check if AI features are available
});