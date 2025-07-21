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

    function setupGlobalEventListeners() {
        document.getElementById('searchBtn').addEventListener('click', () => network.searchAndAddMovie());
        document.getElementById('movieSearch').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') network.searchAndAddMovie();
        });

        document.getElementById('saveBtn').addEventListener('click', showSaveDialog);
        document.getElementById('loadBtn').addEventListener('click', showLoadDialog);
        document.getElementById('clearBtn').addEventListener('click', () => network.clearNetwork());
        document.getElementById('centerBtn').addEventListener('click', () => network.centerNetwork());
        document.getElementById('labelsBtn').addEventListener('click', () => network.toggleLabels());

        document.getElementById('closeSaveBtn').addEventListener('click', closeSaveDialog);
        document.getElementById('confirmSaveBtn').addEventListener('click', saveNetwork);
        document.getElementById('closeLoadBtn').addEventListener('click', closeLoadDialog);
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

    setupGlobalEventListeners();
});