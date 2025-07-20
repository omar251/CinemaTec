        class DynamicMovieNetwork {
            constructor() {
                this.apiBase = '/api';
                this.nodes = [];
                this.links = [];
                this.nodeMap = new Map();
                this.showLabels = true;
                this.nextNodeId = 0;
                
                this.setupVisualization();
                this.setupEventListeners();
            }

            setupVisualization() {
                const svg = d3.select('#network-svg');
                const width = window.innerWidth;
                const height = window.innerHeight - 80;

                this.svg = svg;
                this.width = width;
                this.height = height;

                // Create main group for zooming/panning
                this.g = svg.append('g');

                // Setup zoom behavior
                this.zoom = d3.zoom()
                    .scaleExtent([0.1, 4])
                    .on('zoom', (event) => {
                        this.g.attr('transform', event.transform);
                    });

                svg.call(this.zoom);

                // Create simulation
                this.simulation = d3.forceSimulation()
                    .force('link', d3.forceLink().id(d => d.id).distance(120))
                    .force('charge', d3.forceManyBody().strength(-400))
                    .force('center', d3.forceCenter(width / 2, height / 2))
                    .force('collision', d3.forceCollide().radius(35));

                // Create containers for links and nodes
                this.linkContainer = this.g.append('g').attr('class', 'links');
                this.nodeContainer = this.g.append('g').attr('class', 'nodes');
                this.labelContainer = this.g.append('g').attr('class', 'labels');

                this.colorScale = d3.scaleOrdinal()
                    .domain([0, 1, 2, 3])
                    .range(['#e94560', '#f6e05e', '#10b981', '#3b82f6']);
            }

            setupEventListeners() {
                // Event delegation for dynamically created sidebar elements
                document.addEventListener('click', (e) => {
                    // Movie item clicks
                    if (e.target.closest('.movie-item')) {
                        const movieItem = e.target.closest('.movie-item');
                        const nodeId = parseInt(movieItem.dataset.nodeId);
                        if (nodeId !== undefined) {
                            this.focusOnNode(nodeId);
                        }
                    }
                    
                    // Load details button clicks
                    if (e.target.closest('.load-details')) {
                        e.stopPropagation();
                        const loadBtn = e.target.closest('.load-details');
                        const nodeId = parseInt(loadBtn.dataset.nodeId);
                        if (nodeId !== undefined) {
                            this.loadMovieDetails(nodeId);
                        }
                    }

                    // Network list item clicks
                    if (e.target.closest('.saved-network-item') && !e.target.closest('.action-btn')) {
                        const networkItem = e.target.closest('.saved-network-item');
                        const networkId = networkItem.dataset.networkId;
                        if (networkId) {
                            selectNetwork(networkId);
                        }
                    }

                    // Action button clicks
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

                // Event delegation for mouse hover on sidebar items
                document.addEventListener('mouseover', (e) => {
                    if (e.target.closest('.movie-item')) {
                        const movieItem = e.target.closest('.movie-item');
                        const nodeId = parseInt(movieItem.dataset.nodeId);
                        if (nodeId !== undefined) {
                            this.showMoviePreview(nodeId);
                        }
                    }
                });

                document.addEventListener('mouseout', (e) => {
                    if (e.target.closest('.movie-item')) {
                        this.hideMoviePreview();
                    }
                });

                // Window resize
                window.addEventListener('resize', () => {
                    this.handleResize();
                });
            }

            handleResize() {
                const width = window.innerWidth;
                const height = window.innerHeight - 80;
                
                this.width = width;
                this.height = height;
                
                this.svg.attr('width', width).attr('height', height);
                this.simulation.force('center', d3.forceCenter(width / 2, height / 2));
                this.simulation.alpha(0.3).restart();
            }

            async searchMovie(query) {
                try {
                    const response = await fetch(`${this.apiBase}/search/movies/fast?query=${encodeURIComponent(query)}`);
                    if (!response.ok) throw new Error('Search failed');
                    const data = await response.json();
                    return data[0]?.movie || null;
                } catch (error) {
                    console.error('Search error:', error);
                    return null;
                }
            }

            async getRelatedMovies(movieId) {
                try {
                    const response = await fetch(`${this.apiBase}/movies/${movieId}/related/fast`);
                    if (!response.ok) throw new Error('Failed to get related movies');
                    const data = await response.json();
                    return data.slice(0, 8); // Limit to 8 related movies
                } catch (error) {
                    console.error('Related movies error:', error);
                    return [];
                }
            }

            async getFullMovieDetails(movieId) {
                try {
                    const response = await fetch(`${this.apiBase}/movies/${movieId}/full`);
                    if (!response.ok) throw new Error('Failed to get movie details');
                    const data = await response.json();
                    return data;
                } catch (error) {
                    console.error('Movie details error:', error);
                    return null;
                }
            }

            addMovieToNetwork(movie, depth = 0, isNew = true, fullDetails = null) {
                const movieKey = `${movie.title}_${movie.year}`;
                
                if (this.nodeMap.has(movieKey)) {
                    const existingNode = this.nodeMap.get(movieKey);
                    // Update with full details if provided
                    if (fullDetails) {
                        existingNode.fullDetails = fullDetails;
                        this.updateSidebar();
                    }
                    return existingNode;
                }

                const node = {
                    id: this.nextNodeId++,
                    title: movie.title,
                    year: movie.year,
                    traktId: movie.ids.trakt,
                    depth: depth,
                    movieKey: movieKey,
                    x: this.width / 2 + (Math.random() - 0.5) * 200,
                    y: this.height / 2 + (Math.random() - 0.5) * 200,
                    isNew: isNew,
                    fullDetails: fullDetails || null,
                    // Store basic details from movie object
                    basicDetails: {
                        overview: movie.overview,
                        rating: movie.rating,
                        votes: movie.votes,
                        genres: movie.genres,
                        runtime: movie.runtime,
                        certification: movie.certification,
                        trailer: movie.trailer
                    }
                };

                this.nodes.push(node);
                this.nodeMap.set(movieKey, node);
                
                this.updateVisualization();
                this.updateSidebar();
                this.updateStats();

                return node;
            }

            addConnection(sourceNode, targetNode, isNew = true) {
                // Check if connection already exists
                const existingLink = this.links.find(link => 
                    (link.source.id === sourceNode.id && link.target.id === targetNode.id) ||
                    (link.source.id === targetNode.id && link.target.id === sourceNode.id)
                );

                if (existingLink) return existingLink;

                const link = {
                    source: sourceNode,
                    target: targetNode,
                    isNew: isNew
                };

                this.links.push(link);
                return link;
            }

            async expandNode(node) {
                if (node.expanding) return; // Prevent multiple expansions
                
                node.expanding = true;
                this.showLoading(true);
                this.showNotification(`Expanding ${node.title}...`);

                try {
                    const relatedMovies = await this.getRelatedMovies(node.traktId);
                    
                    for (const relatedMovie of relatedMovies) {
                        const relatedNode = this.addMovieToNetwork(relatedMovie, node.depth + 1, true);
                        this.addConnection(node, relatedNode, true);
                    }

                    this.showNotification(`Added ${relatedMovies.length} related movies!`, 'success');
                    
                } catch (error) {
                    this.showNotification('Failed to expand network', 'error');
                } finally {
                    node.expanding = false;
                    this.showLoading(false);
                    this.updateVisualization();
                }
            }

            updateVisualization() {
                // Update simulation data
                this.simulation.nodes(this.nodes);
                this.simulation.force('link').links(this.links);

                // Update links
                const linkSelection = this.linkContainer
                    .selectAll('line')
                    .data(this.links, d => `${d.source.id}-${d.target.id}`);

                linkSelection.exit().remove();

                const linkEnter = linkSelection.enter()
                    .append('line')
                    .attr('class', d => `link ${d.isNew ? 'new' : ''}`);

                linkEnter.merge(linkSelection)
                    .attr('class', d => `link ${d.isNew ? 'new' : ''}`);

                // Update nodes
                const nodeSelection = this.nodeContainer
                    .selectAll('circle')
                    .data(this.nodes, d => d.id);

                nodeSelection.exit().remove();

                const nodeEnter = nodeSelection.enter()
                    .append('circle')
                    .attr('class', 'node')
                    .attr('r', d => d.depth === 0 ? 15 : 10)
                    .attr('fill', d => this.colorScale(Math.min(d.depth, 3)))
                    .call(this.getDragBehavior())
                    .on('click', (event, d) => this.expandNode(d))
                    .on('mouseover', (event, d) => this.showTooltip(event, d))
                    .on('mouseout', () => this.hideTooltip());

                nodeEnter.merge(nodeSelection)
                    .attr('class', d => `node ${d.expanding ? 'expanding' : ''}`)
                    .attr('fill', d => this.colorScale(Math.min(d.depth, 3)));

                // Update labels
                const labelSelection = this.labelContainer
                    .selectAll('text')
                    .data(this.nodes, d => d.id);

                labelSelection.exit().remove();

                const labelEnter = labelSelection.enter()
                    .append('text')
                    .attr('class', 'node-label')
                    .text(d => d.title)
                    .style('display', this.showLabels ? 'block' : 'none');

                labelEnter.merge(labelSelection)
                    .text(d => d.title)
                    .style('display', this.showLabels ? 'block' : 'none');

                // Restart simulation
                this.simulation.alpha(0.3).restart();

                // Setup tick function
                this.simulation.on('tick', () => {
                    this.linkContainer.selectAll('line')
                        .attr('x1', d => d.source.x)
                        .attr('y1', d => d.source.y)
                        .attr('x2', d => d.target.x)
                        .attr('y2', d => d.target.y);

                    this.nodeContainer.selectAll('circle')
                        .attr('cx', d => d.x)
                        .attr('cy', d => d.y);

                    this.labelContainer.selectAll('text')
                        .attr('x', d => d.x)
                        .attr('y', d => d.y + 25);
                });

                // Clear new flags after animation
                setTimeout(() => {
                    this.links.forEach(link => link.isNew = false);
                    this.nodes.forEach(node => node.isNew = false);
                }, 1000);
            }

            getDragBehavior() {
                return d3.drag()
                    .on('start', (event, d) => {
                        if (!event.active) this.simulation.alphaTarget(0.3).restart();
                        d.fx = d.x;
                        d.fy = d.y;
                    })
                    .on('drag', (event, d) => {
                        d.fx = event.x;
                        d.fy = event.y;
                    })
                    .on('end', (event, d) => {
                        if (!event.active) this.simulation.alphaTarget(0);
                        d.fx = null;
                        d.fy = null;
                    });
            }

            showTooltip(event, d) {
                const tooltip = document.getElementById('tooltip');
                tooltip.style.display = 'block';
                tooltip.style.left = (event.pageX + 10) + 'px';
                tooltip.style.top = (event.pageY - 10) + 'px';
                
                const details = d.fullDetails || d.basicDetails || {};
                const rating = details.rating ? `⭐ ${details.rating.toFixed(1)}` : '';
                const votes = details.votes ? `(${details.votes.toLocaleString()} votes)` : '';
                const runtime = details.runtime ? `⏱️ ${details.runtime}min` : '';
                const certification = details.certification ? `🎬 ${details.certification}` : '';
                const genres = details.genres ? `🎭 ${details.genres.slice(0, 3).join(', ')}` : '';
                const watchers = details.stats?.watchers ? `👥 ${details.stats.watchers.toLocaleString()} watchers` : '';
                
                tooltip.innerHTML = `
                    <div style="font-weight: bold; margin-bottom: 8px; color: #f6e05e;">
                        ${d.title} (${d.year})
                    </div>
                    ${rating ? `<div style="margin-bottom: 4px;">${rating} ${votes}</div>` : ''}
                    ${runtime || certification ? `<div style="margin-bottom: 4px;">${runtime} ${certification}</div>` : ''}
                    ${genres ? `<div style="margin-bottom: 4px;">${genres}</div>` : ''}
                    ${watchers ? `<div style="margin-bottom: 4px;">${watchers}</div>` : ''}
                    <div style="margin-top: 8px; font-size: 11px; color: #b0b0b0;">
                        Depth: ${d.depth} • Click to expand
                    </div>
                `;
            }

            hideTooltip() {
                document.getElementById('tooltip').style.display = 'none';
            }

            updateSidebar() {
                const movieList = document.getElementById('movieList');
                
                if (this.nodes.length === 0) {
                    movieList.innerHTML = `
                        <div style="text-align: center; color: var(--text-secondary); padding: 20px;">
                            Search for a movie to start building your network!
                        </div>
                    `;
                    return;
                }

                const sortedNodes = [...this.nodes].sort((a, b) => {
                    if (a.depth !== b.depth) return a.depth - b.depth;
                    // Sort by rating if available, then by title
                    const aRating = (a.fullDetails?.rating || a.basicDetails?.rating || 0);
                    const bRating = (b.fullDetails?.rating || b.basicDetails?.rating || 0);
                    if (aRating !== bRating) return bRating - aRating;
                    return a.title.localeCompare(b.title);
                });

                movieList.innerHTML = sortedNodes.map(node => {
                    const details = node.fullDetails || node.basicDetails || {};
                    const rating = details.rating ? `⭐ ${details.rating.toFixed(1)}` : '';
                    const genres = details.genres ? details.genres.slice(0, 2).join(', ') : '';
                    const runtime = details.runtime ? `${details.runtime}min` : '';
                    const watchers = details.stats?.watchers ? `${(details.stats.watchers / 1000).toFixed(0)}K` : '';
                    
                    return `
                        <div class="movie-item" data-node-id="${node.id}">
                            <div class="movie-header">
                                <div class="movie-title">${node.title}</div>
                                <div class="movie-rating">${rating}</div>
                            </div>
                            <div class="movie-meta">
                                <span class="movie-year">${node.year}</span>
                                ${runtime ? `<span class="movie-runtime">• ${runtime}</span>` : ''}
                                ${watchers ? `<span class="movie-watchers">• ${watchers} watchers</span>` : ''}
                            </div>
                            ${genres ? `<div class="movie-genres">${genres}</div>` : ''}
                            <div class="movie-depth">Depth: ${node.depth}</div>
                            ${!node.fullDetails ? '<div class="load-details" data-node-id="' + node.id + '">📄 Load Details</div>' : ''}
                        </div>
                    `;
                }).join('');
            }

            updateStats() {
                const stats = document.getElementById('networkStats');
                stats.textContent = `${this.nodes.length} movies, ${this.links.length} connections`;
            }

            focusOnNode(nodeId) {
                const node = this.nodes.find(n => n.id === nodeId);
                if (!node) return;

                const transform = d3.zoomIdentity
                    .translate(this.width / 2 - node.x, this.height / 2 - node.y)
                    .scale(1.5);

                this.svg.transition()
                    .duration(750)
                    .call(this.zoom.transform, transform);
            }

            async searchAndAddMovie() {
                const searchInput = document.getElementById('movieSearch');
                const query = searchInput.value.trim();
                
                if (!query) return;

                this.showLoading(true);
                
                try {
                    const movie = await this.searchMovie(query);
                    
                    if (movie) {
                        // Get full details for the searched movie
                        const fullDetails = await this.getFullMovieDetails(movie.ids.trakt);
                        const node = this.addMovieToNetwork(movie, 0, true, fullDetails);
                        this.showNotification(`Added "${movie.title}" to network!`, 'success');
                        searchInput.value = '';
                        
                        // Focus on the new node
                        setTimeout(() => this.focusOnNode(node.id), 500);
                    } else {
                        this.showNotification('Movie not found', 'error');
                    }
                } catch (error) {
                    this.showNotification('Search failed', 'error');
                } finally {
                    this.showLoading(false);
                }
            }

            clearNetwork() {
                this.nodes = [];
                this.links = [];
                this.nodeMap.clear();
                this.nextNodeId = 0;
                
                this.updateVisualization();
                this.updateSidebar();
                this.updateStats();
                
                this.showNotification('Network cleared', 'success');
            }

            centerNetwork() {
                const transform = d3.zoomIdentity.translate(this.width / 2, this.height / 2).scale(1);
                this.svg.transition().duration(750).call(this.zoom.transform, transform);
            }

            toggleLabels() {
                this.showLabels = !this.showLabels;
                this.labelContainer.selectAll('text')
                    .style('display', this.showLabels ? 'block' : 'none');
            }

            showLoading(show) {
                const loading = document.getElementById('loadingIndicator');
                loading.style.display = show ? 'block' : 'none';
            }

            showNotification(message, type = 'success') {
                const notification = document.getElementById('notification');
                notification.textContent = message;
                notification.className = `notification ${type}`;
                notification.classList.add('show');
                
                setTimeout(() => {
                    notification.classList.remove('show');
                }, 3000);
            }

            // Network Storage Methods
            async saveNetworkToServer(name, description) {
                try {
                    const networkData = {
                        name: name,
                        description: description,
                        nodes: this.nodes,
                        links: this.links.map(link => ({
                            source: typeof link.source === 'object' ? link.source.id : link.source,
                            target: typeof link.target === 'object' ? link.target.id : link.target
                        })),
                        settings: {
                            showLabels: this.showLabels,
                            colorScheme: 'default'
                        },
                        seedMovie: this.nodes.find(n => n.depth === 0)?.title || null
                    };

                    const response = await fetch(`/api/networks/save`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(networkData)
                    });

                    if (!response.ok) throw new Error('Failed to save network');
                    
                    const result = await response.json();
                    return result;

                } catch (error) {
                    console.error('Save error:', error);
                    throw error;
                }
            }

            async loadNetworkFromServer(networkId) {
                try {
                    const response = await fetch(`/api/networks/${networkId}`);
                    if (!response.ok) throw new Error('Failed to load network');
                    
                    const networkData = await response.json();
                    return networkData;

                } catch (error) {
                    console.error('Load error:', error);
                    throw error;
                }
            }

            async getSavedNetworks() {
                try {
                    const response = await fetch(`/api/networks`);
                    if (!response.ok) throw new Error('Failed to get saved networks');
                    
                    const networks = await response.json();
                    return networks;

                } catch (error) {
                    console.error('Get networks error:', error);
                    return [];
                }
            }

            async deleteNetworkFromServer(networkId) {
                try {
                    const response = await fetch(`/api/networks/${networkId}`, {
                        method: 'DELETE'
                    });
                    
                    if (!response.ok) throw new Error('Failed to delete network');
                    
                    const result = await response.json();
                    return result;

                } catch (error) {
                    console.error('Delete error:', error);
                    throw error;
                }
            }

            loadNetworkData(networkData) {
                // Clear current network
                this.nodes = [];
                this.links = [];
                this.nodeMap.clear();
                this.nextNodeId = 0;

                // Load nodes
                networkData.nodes.forEach(nodeData => {
                    const node = {
                        ...nodeData,
                        id: this.nextNodeId++,
                        x: this.width / 2 + (Math.random() - 0.5) * 400,
                        y: this.height / 2 + (Math.random() - 0.5) * 400
                    };
                    this.nodes.push(node);
                    this.nodeMap.set(node.movieKey, node);
                });

                // Load links
                networkData.links.forEach(linkData => {
                    const sourceNode = this.nodes.find(n => n.id === linkData.source);
                    const targetNode = this.nodes.find(n => n.id === linkData.target);
                    
                    if (sourceNode && targetNode) {
                        this.addConnection(sourceNode, targetNode, false);
                    }
                });

                // Apply settings
                if (networkData.settings) {
                    this.showLabels = networkData.settings.showLabels !== false;
                }

                // Update visualization
                this.updateVisualization();
                this.updateSidebar();
                this.updateStats();

                // Center the network
                setTimeout(() => this.centerNetwork(), 1000);
            }

            async loadMovieDetails(nodeId) {
                const node = this.nodes.find(n => n.id === nodeId);
                if (!node || node.fullDetails) return;

                this.showLoading(true);
                
                try {
                    const fullDetails = await this.getFullMovieDetails(node.traktId);
                    if (fullDetails) {
                        node.fullDetails = fullDetails;
                        this.updateSidebar();
                        this.showNotification(`Loaded details for ${node.title}`, 'success');
                    }
                } catch (error) {
                    this.showNotification('Failed to load movie details', 'error');
                } finally {
                    this.showLoading(false);
                }
            }

            showMoviePreview(nodeId) {
                const node = this.nodes.find(n => n.id === nodeId);
                if (!node) return;

                // Highlight the node in the network
                this.nodeContainer.selectAll('circle')
                    .style('opacity', d => d.id === nodeId ? 1 : 0.3)
                    .style('stroke-width', d => d.id === nodeId ? 4 : 2);

                this.labelContainer.selectAll('text')
                    .style('opacity', d => d.id === nodeId ? 1 : 0.3);
            }

            hideMoviePreview() {
                // Reset all nodes to normal opacity
                this.nodeContainer.selectAll('circle')
                    .style('opacity', 1)
                    .style('stroke-width', 2);

                this.labelContainer.selectAll('text')
                    .style('opacity', 1);
            }
        }

        // Global functions for button clicks
        let network;

        function searchAndAddMovie() {
            console.log('searchAndAddMovie called');
            if (!network) {
                console.error('Network not initialized');
                alert('❌ Network not initialized. Please refresh the page.');
                return;
            }
            try {
                network.searchAndAddMovie();
            } catch (error) {
                console.error('Search error:', error);
                alert('❌ Search failed: ' + error.message);
            }
        }

        function clearNetwork() {
            console.log('clearNetwork called');
            if (!network) {
                alert('❌ Network not initialized');
                return;
            }
            network.clearNetwork();
        }

        function centerNetwork() {
            console.log('centerNetwork called');
            if (!network) {
                alert('❌ Network not initialized');
                return;
            }
            network.centerNetwork();
        }

        function toggleLabels() {
            console.log('toggleLabels called');
            if (!network) {
                alert('❌ Network not initialized');
                return;
            }
            network.toggleLabels();
        }

        // Save/Load Dialog Functions
        function showSaveDialog() {
            if (network.nodes.length === 0) {
                network.showNotification('No network to save', 'error');
                return;
            }

            const modal = document.getElementById('saveModal');
            const preview = document.getElementById('savePreview');
            
            // Generate preview
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
            
            // Suggest a name based on seed movie
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
                network.showNotification('Please enter a network name', 'error');
                return;
            }

            network.showLoading(true);
            
            try {
                const result = await network.saveNetworkToServer(name, description);
                
                if (result.success) {
                    network.showNotification(`Network "${name}" saved successfully!`, 'success');
                    closeSaveDialog();
                    
                    // Clear form
                    document.getElementById('networkName').value = '';
                    document.getElementById('networkDescription').value = '';
                } else {
                    network.showNotification('Failed to save network', 'error');
                }
                
            } catch (error) {
                network.showNotification('Failed to save network', 'error');
            } finally {
                network.showLoading(false);
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
                const networks = await network.getSavedNetworks();
                
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
                            <div class="network-item-actions">
                                <button class="action-btn" data-action="load" data-network-id="${net.id}">
                                    📂 Load
                                </button>
                                <button class="action-btn" data-action="export" data-network-id="${net.id}" data-format="json">
                                    📤 Export
                                </button>
                                <button class="action-btn danger" data-action="delete" data-network-id="${net.id}">
                                    🗑️ Delete
                                </button>
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
            // Remove previous selection
            document.querySelectorAll('.saved-network-item').forEach(item => {
                item.classList.remove('selected');
            });
            
            // Add selection to clicked item
            event.currentTarget.classList.add('selected');
            selectedNetworkId = networkId;
        }

        async function loadSelectedNetwork(networkId) {
            network.showLoading(true);
            
            try {
                const networkData = await network.loadNetworkFromServer(networkId);
                network.loadNetworkData(networkData);
                
                network.showNotification(`Network "${networkData.name}" loaded successfully!`, 'success');
                closeLoadDialog();
                
            } catch (error) {
                network.showNotification('Failed to load network', 'error');
            } finally {
                network.showLoading(false);
            }
        }

        async function deleteNetwork(networkId) {
            if (!confirm('Are you sure you want to delete this network? This action cannot be undone.')) {
                return;
            }
            
            try {
                await network.deleteNetworkFromServer(networkId);
                network.showNotification('Network deleted successfully', 'success');
                refreshNetworksList();
                
            } catch (error) {
                network.showNotification('Failed to delete network', 'error');
            }
        }

        async function exportNetwork(networkId, format) {
            try {
                const response = await fetch(`/api/networks/${networkId}/export/${format}`);
                
                if (response.ok) {
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || `network.${format}`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                    
                    network.showNotification(`Network exported as ${format.toUpperCase()}`, 'success');
                } else {
                    network.showNotification('Failed to export network', 'error');
                }
                
            } catch (error) {
                network.showNotification('Failed to export network', 'error');
            }
        }

        // Close modals when clicking outside
        window.addEventListener('click', (event) => {
            const saveModal = document.getElementById('saveModal');
            const loadModal = document.getElementById('loadModal');
            
            if (event.target === saveModal) {
                closeSaveDialog();
            }
            if (event.target === loadModal) {
                closeLoadDialog();
            }
        });

        // Initialize when page loads
        document.addEventListener('DOMContentLoaded', () => {
            console.log('Initializing Dynamic Movie Network...');
            
            // Check if D3 is loaded
            if (typeof d3 === 'undefined') {
                console.error('D3.js failed to load from CDN');
                document.body.innerHTML += '<div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: red; color: white; padding: 20px; border-radius: 10px; z-index: 9999;">❌ D3.js failed to load. Check internet connection.</div>';
                return;
            }
            
            try {
                network = new DynamicMovieNetwork();
                console.log('✅ Network initialized successfully');
                
                // Setup global event listeners after network is initialized
                setupGlobalEventListeners();
                console.log('✅ Event listeners setup completed');
                
            } catch (error) {
                console.error('❌ Network initialization failed:', error);
                document.body.innerHTML += '<div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: red; color: white; padding: 20px; border-radius: 10px; z-index: 9999;">❌ Network initialization failed: ' + error.message + '</div>';
            }
        });

        // Setup global event listeners
        function setupGlobalEventListeners() {
            console.log('Setting up global event listeners...');
            
            // Search functionality
            const searchBtn = document.getElementById('searchBtn');
            const movieSearch = document.getElementById('movieSearch');
            
            if (searchBtn) {
                searchBtn.addEventListener('click', () => {
                    console.log('Search button clicked');
                    if (network) network.searchAndAddMovie();
                });
                console.log('✅ Search button listener added');
            }
            
            if (movieSearch) {
                movieSearch.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter' && network) {
                        network.searchAndAddMovie();
                    }
                });
                console.log('✅ Search input listener added');
            }

            // Control buttons
            const saveBtn = document.getElementById('saveBtn');
            const loadBtn = document.getElementById('loadBtn');
            const clearBtn = document.getElementById('clearBtn');
            const centerBtn = document.getElementById('centerBtn');
            const labelsBtn = document.getElementById('labelsBtn');
            
            if (saveBtn) {
                saveBtn.addEventListener('click', () => {
                    console.log('Save button clicked');
                    showSaveDialog();
                });
                console.log('✅ Save button listener added');
            }
            
            if (loadBtn) {
                loadBtn.addEventListener('click', () => {
                    console.log('Load button clicked');
                    showLoadDialog();
                });
                console.log('✅ Load button listener added');
            }
            
            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    console.log('Clear button clicked');
                    if (network) network.clearNetwork();
                });
                console.log('✅ Clear button listener added');
            }
            
            if (centerBtn) {
                centerBtn.addEventListener('click', () => {
                    console.log('Center button clicked');
                    if (network) network.centerNetwork();
                });
                console.log('✅ Center button listener added');
            }
            
            if (labelsBtn) {
                labelsBtn.addEventListener('click', () => {
                    console.log('Labels button clicked');
                    if (network) network.toggleLabels();
                });
                console.log('✅ Labels button listener added');
            }

            // Modal buttons
            const cancelSaveBtn = document.getElementById('cancelSaveBtn');
            const confirmSaveBtn = document.getElementById('confirmSaveBtn');
            const cancelLoadBtn = document.getElementById('cancelLoadBtn');
            const refreshNetworksBtn = document.getElementById('refreshNetworksBtn');
            const closeSaveBtn = document.getElementById('closeSaveBtn');
            const closeLoadBtn = document.getElementById('closeLoadBtn');
            
            if (cancelSaveBtn) {
                cancelSaveBtn.addEventListener('click', closeSaveDialog);
                console.log('✅ Cancel save button listener added');
            }
            
            if (confirmSaveBtn) {
                confirmSaveBtn.addEventListener('click', saveNetwork);
                console.log('✅ Confirm save button listener added');
            }
            
            if (cancelLoadBtn) {
                cancelLoadBtn.addEventListener('click', closeLoadDialog);
                console.log('✅ Cancel load button listener added');
            }
            
            if (refreshNetworksBtn) {
                refreshNetworksBtn.addEventListener('click', refreshNetworksList);
                console.log('✅ Refresh networks button listener added');
            }
            
            if (closeSaveBtn) {
                closeSaveBtn.addEventListener('click', closeSaveDialog);
                console.log('✅ Close save button listener added');
            }
            
            if (closeLoadBtn) {
                closeLoadBtn.addEventListener('click', closeLoadDialog);
                console.log('✅ Close load button listener added');
            }
        }
