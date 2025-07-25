import * as api from './api.js';
import * as ui from './ui.js';

export class DynamicMovieNetwork {
    constructor() {
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

        this.g = svg.append('g');

        this.zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                this.g.attr('transform', event.transform);
            });

        svg.call(this.zoom);

        this.simulation = d3.forceSimulation()
            .force('link', d3.forceLink().id(d => d.id).distance(120))
            .force('charge', d3.forceManyBody().strength(-400))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(35));

        this.linkContainer = this.g.append('g').attr('class', 'links');
        this.nodeContainer = this.g.append('g').attr('class', 'nodes');
        this.labelContainer = this.g.append('g').attr('class', 'labels');

        // Color coding options
        this.colorMode = 'depth'; // Default mode
        this.setupColorScales();
    }

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('.movie-item')) {
                const movieItem = e.target.closest('.movie-item');
                const nodeId = parseInt(movieItem.dataset.nodeId);
                if (nodeId !== undefined) {
                    this.focusOnNode(nodeId);
                }
            }
            
            if (e.target.closest('.load-details')) {
                e.stopPropagation();
                const loadBtn = e.target.closest('.load-details');
                const nodeId = parseInt(loadBtn.dataset.nodeId);
                if (nodeId !== undefined) {
                    this.loadMovieDetails(nodeId);
                }
            }

            if (e.target.closest('.view-details-btn')) {
                e.stopPropagation();
                const detailsBtn = e.target.closest('.view-details-btn');
                const nodeId = parseInt(detailsBtn.dataset.nodeId);
                if (nodeId !== undefined) {
                    const node = this.nodes.find(n => n.id === nodeId);
                    if (node) {
                        this.showMovieDetails(node);
                    }
                }
            }
        });

        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // Listen for expand node events from movie details modal
        document.addEventListener('expandNode', (e) => {
            const nodeId = e.detail.nodeId;
            const node = this.nodes.find(n => n.id === nodeId);
            if (node) {
                this.expandNode(node);
            }
        });

        // Handle sidebar hover effects for network highlighting
        document.addEventListener('highlightNetworkNode', (e) => {
            this.highlightNode(e.detail.nodeId);
        });

        document.addEventListener('clearNetworkHighlight', () => {
            this.clearHighlight();
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

    addMovieToNetwork(movie, depth = 0, isNew = true, fullDetails = null) {
        const movieKey = `${movie.title}_${movie.year}`;
        
        if (this.nodeMap.has(movieKey)) {
            const existingNode = this.nodeMap.get(movieKey);
            if (fullDetails) {
                existingNode.fullDetails = fullDetails;
                ui.updateSidebar(this.nodes);
            }
            return existingNode;
        }

        const node = {
            id: this.nextNodeId++,
            title: movie.title,
            year: movie.year,
            traktId: movie.ids?.trakt || movie.traktId || movie.id,
            depth: depth,
            movieKey: movieKey,
            x: this.width / 2 + (Math.random() - 0.5) * 200,
            y: this.height / 2 + (Math.random() - 0.5) * 200,
            isNew: isNew,
            fullDetails: fullDetails || null,
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
        ui.updateSidebar(this.nodes);
        ui.updateStats(this.nodes, this.links);

        return node;
    }

    addConnection(sourceNode, targetNode, isNew = true) {
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
        if (node.expanding) return;
        
        node.expanding = true;
        ui.showLoading(true);
        ui.showNotification(`Expanding ${node.title}...`);

        try {
            const relatedMovies = await api.getRelatedMovies(node.traktId);
            
            for (const relatedMovie of relatedMovies) {
                const relatedNode = this.addMovieToNetwork(relatedMovie, node.depth + 1, true);
                this.addConnection(node, relatedNode, true);
            }

            ui.showNotification(`Added ${relatedMovies.length} related movies!`, 'success');
            
        } catch (error) {
            ui.showNotification('Failed to expand network', 'error');
        } finally {
            node.expanding = false;
            ui.showLoading(false);
            this.updateVisualization();
        }
    }

    updateVisualization() {
        this.simulation.nodes(this.nodes);
        this.simulation.force('link').links(this.links);

        const linkSelection = this.linkContainer
            .selectAll('line')
            .data(this.links, d => `${d.source.id}-${d.target.id}`);

        linkSelection.exit().remove();

        const linkEnter = linkSelection.enter()
            .append('line')
            .attr('class', d => `link ${d.isNew ? 'new' : ''}`);

        linkEnter.merge(linkSelection)
            .attr('class', d => `link ${d.isNew ? 'new' : ''}`);

        const nodeSelection = this.nodeContainer
            .selectAll('circle')
            .data(this.nodes, d => d.id);

        nodeSelection.exit().remove();

        const nodeEnter = nodeSelection.enter()
            .append('circle')
            .attr('class', 'node')
            .attr('r', d => d.depth === 0 ? 15 : 10)
            .attr('fill', d => this.getNodeColor(d))
            .call(this.getDragBehavior())
            .on('click', (event, d) => this.handleNodeClick(event, d))
            .on('mouseover', (event, d) => ui.showTooltip(event, d))
            .on('mouseout', () => ui.hideTooltip());

        nodeEnter.merge(nodeSelection)
            .attr('class', d => `node ${d.expanding ? 'expanding' : ''}`)
            .attr('fill', d => this.getNodeColor(d));

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

        this.simulation.alpha(0.3).restart();

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

    focusOnNode(nodeId) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) return;

        // Get current viewport dimensions
        const svgRect = this.svg.node().getBoundingClientRect();
        const centerX = svgRect.width / 2;
        const centerY = svgRect.height / 2;

        // Calculate the transform to center the node
        const scale = 1.5;
        const transform = d3.zoomIdentity
            .translate(centerX, centerY)
            .scale(scale)
            .translate(-node.x, -node.y);

        this.svg.transition()
            .duration(750)
            .call(this.zoom.transform, transform);
    }

    async searchAndAddMovie() {
        const searchInput = document.getElementById('movieSearch');
        const query = searchInput.value.trim();
        
        if (!query) return;

        ui.showLoading(true);
        
        try {
            const movie = await api.searchMovie(query);
            
            if (movie) {
                const fullDetails = await api.getFullMovieDetails(movie.ids.trakt);
                const node = this.addMovieToNetwork(movie, 0, true, fullDetails);
                ui.showNotification(`Added "${movie.title}" to network!`, 'success');
                searchInput.value = '';
                
                setTimeout(() => this.focusOnNode(node.id), 500);
            } else {
                ui.showNotification('Movie not found', 'error');
            }
        } catch (error) {
            ui.showNotification('Search failed', 'error');
        } finally {
            ui.showLoading(false);
        }
    }

    removeNode(nodeId) {
        const nodeToRemove = this.nodes.find(n => n.id === nodeId);
        if (!nodeToRemove) return;

        // Remove node from nodes array
        this.nodes = this.nodes.filter(n => n.id !== nodeId);

        // Remove links connected to this node
        this.links = this.links.filter(link => 
            (typeof link.source === 'object' ? link.source.id : link.source) !== nodeId &&
            (typeof link.target === 'object' ? link.target.id : link.target) !== nodeId
        );

        // Remove from nodeMap
        this.nodeMap.delete(nodeToRemove.movieKey);

        // Update visualization and UI
        this.updateVisualization();
        ui.updateSidebar(this.nodes);
        ui.updateStats(this.nodes, this.links);
    }

    clearNetwork() {
        this.nodes = [];
        this.links = [];
        this.nodeMap.clear();
        this.nextNodeId = 0;
        
        this.updateVisualization();
        ui.updateSidebar(this.nodes);
        ui.updateStats(this.nodes, this.links);
        
        ui.showNotification('Network cleared', 'success');
    }

    centerNetwork() {
        // Get current viewport dimensions
        const svgRect = this.svg.node().getBoundingClientRect();
        const centerX = svgRect.width / 2;
        const centerY = svgRect.height / 2;

        // Calculate the center of all nodes
        if (this.nodes.length > 0) {
            const avgX = this.nodes.reduce((sum, node) => sum + node.x, 0) / this.nodes.length;
            const avgY = this.nodes.reduce((sum, node) => sum + node.y, 0) / this.nodes.length;

            // Create transform to center the network
            const transform = d3.zoomIdentity
                .translate(centerX, centerY)
                .scale(1)
                .translate(-avgX, -avgY);

            this.svg.transition().duration(750).call(this.zoom.transform, transform);
        } else {
            // If no nodes, just reset to center
            const transform = d3.zoomIdentity.translate(centerX, centerY).scale(1);
            this.svg.transition().duration(750).call(this.zoom.transform, transform);
        }
    }

    toggleLabels() {
        this.showLabels = !this.showLabels;
        this.labelContainer.selectAll('text')
            .style('display', this.showLabels ? 'block' : 'none');
    }

    loadNetworkData(networkData) {
        this.nodes = [];
        this.links = [];
        this.nodeMap.clear();
        this.nextNodeId = 0;

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

        networkData.links.forEach(linkData => {
            const sourceNode = this.nodes.find(n => n.id === linkData.source);
            const targetNode = this.nodes.find(n => n.id === linkData.target);
            
            if (sourceNode && targetNode) {
                this.addConnection(sourceNode, targetNode, false);
            }
        });

        if (networkData.settings) {
            this.showLabels = networkData.settings.showLabels !== false;
        }

        this.updateVisualization();
        ui.updateSidebar(this.nodes);
        ui.updateStats(this.nodes, this.links);

        setTimeout(() => this.centerNetwork(), 1000);
    }

    async handleNodeClick(event, node) {
        // Check if it's Ctrl+click or double-click for expansion
        if (event.ctrlKey || event.metaKey || event.detail === 2) {
            event.preventDefault();
            this.expandNode(node);
            return;
        }
        
        // Single click shows movie details
        await this.showMovieDetails(node);
    }

    async showMovieDetails(node) {
        ui.showLoading(true);
        
        try {
            console.log(`🎬 Loading details for movie: ${node.title} (${node.year})`);
            
            // Load full details if not already loaded
            if (!node.fullDetails) {
                const fullDetails = await api.getFullMovieDetails(node.traktId);
                if (fullDetails && fullDetails.success) {
                    console.log(`✅ Movie details loaded from: ${fullDetails.source}`);
                    node.fullDetails = fullDetails.movie;
                    ui.updateSidebar(this.nodes);
                } else {
                    console.log(`⚠️ No full details available, using basic data`);
                }
            }
            
            // Show detailed movie modal
            console.log(`🎭 Opening movie details modal for: ${node.title}`);
            ui.showMovieDetailsModal(node);
            
        } catch (error) {
            console.error('Failed to show movie details:', error);
            ui.showNotification(`Failed to load movie details: ${error.message}`, 'error');
        } finally {
            ui.showLoading(false);
        }
    }

    async loadMovieDetails(nodeId) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node || node.fullDetails) return;

        ui.showLoading(true);
        
        try {
            const fullDetails = await api.getFullMovieDetails(node.traktId);
            if (fullDetails) {
                node.fullDetails = fullDetails;
                ui.updateSidebar(this.nodes);
                ui.showNotification(`Loaded details for ${node.title}`, 'success');
            }
        } catch (error) {
            ui.showNotification('Failed to load movie details', 'error');
        } finally {
            ui.showLoading(false);
        }
    }

    // Highlight a specific node and dim others
    highlightNode(nodeId) {
        if (!this.svg) {
            console.log('❌ No SVG found for highlighting');
            return;
        }

        console.log('✨ Highlighting node in network:', nodeId);
        console.log('📊 Available nodes:', this.nodes.map(n => n.id));

        // Convert nodeId to number for comparison
        const targetNodeId = parseInt(nodeId);

        this.svg.selectAll('.node')
            .classed('highlighted', d => {
                const isHighlighted = d.id === targetNodeId;
                if (isHighlighted) console.log('🎯 Found matching node:', d.title);
                return isHighlighted;
            })
            .classed('dimmed', d => d.id !== targetNodeId);

        this.svg.selectAll('.link')
            .classed('highlighted', d => {
                const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
                const targetId = typeof d.target === 'object' ? d.target.id : d.target;
                return sourceId === targetNodeId || targetId === targetNodeId;
            })
            .classed('dimmed', d => {
                const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
                const targetId = typeof d.target === 'object' ? d.target.id : d.target;
                return sourceId !== targetNodeId && targetId !== targetNodeId;
            });

        // Also highlight labels if they're visible
        if (this.showLabels) {
            this.svg.selectAll('.node-label')
                .classed('highlighted', d => d.id === targetNodeId)
                .classed('dimmed', d => d.id !== targetNodeId);
        }
    }

    // Clear all highlighting
    clearHighlight() {
        if (!this.svg) return;

        this.svg.selectAll('.node, .link, .node-label')
            .classed('highlighted', false)
            .classed('dimmed', false);
    }

    // Setup different color scales for various purposes
    setupColorScales() {
        this.colorScales = {
            // Original depth-based coloring
            depth: d3.scaleOrdinal()
                .domain([0, 1, 2, 3])
                .range(['#e94560', '#f6e05e', '#10b981', '#3b82f6']),
            
            // Rating-based coloring (poor to excellent) - More defined excellent range
            rating: d3.scaleThreshold()
                .domain([5, 7, 8.5])
                .range(['#d73027', '#fee08b', '#74c476', '#238b45']),
            
            // Genre-based coloring
            genre: d3.scaleOrdinal()
                .domain(['Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Romance', 'Thriller', 'Adventure', 'Fantasy', 'Crime'])
                .range(['#ff4757', '#ffa502', '#2ed573', '#5352ed', '#ff6b81', '#ff9ff3', '#54a0ff', '#7bed9f', '#a4b0be', '#2f3542']),
            
            // Year-based coloring (decades)
            year: d3.scaleOrdinal()
                .domain(['1920s', '1930s', '1940s', '1950s', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s', '2030s'])
                .range(['#2c1810', '#5d4037', '#8b4513', '#d2691e', '#cd853f', '#ff6347', '#ffd700', '#32cd32', '#1e90ff', '#ff1493', '#9c27b0', '#e91e63']),
            
            // Popularity-based coloring (watchers count)
            popularity: d3.scaleSequential()
                .domain([0, 100000])
                .interpolator(d3.interpolateViridis),
            
            // Runtime-based coloring
            runtime: d3.scaleSequential()
                .domain([60, 180])
                .interpolator(d3.interpolatePlasma)
        };
    }

    // Get node color based on current color mode
    getNodeColor(node) {
        const details = node.fullDetails || node.basicDetails || {};
        
        switch (this.colorMode) {
            case 'depth':
                return this.colorScales.depth(Math.min(node.depth, 3));
            
            case 'rating':
                // Check if rating data is available
                if (!details.rating && !node.fullDetails) {
                    return '#666666'; // Gray for missing data
                }
                const rating = details.rating || 5;
                return this.colorScales.rating(rating);
            
            case 'genre':
                // Check if genre data is available
                if (!details.genres?.length && !node.fullDetails) {
                    return '#666666'; // Gray for missing data
                }
                const rawGenre = details.genres?.[0] || 'Unknown';
                // Capitalize first letter to match color scale domain
                const primaryGenre = rawGenre.charAt(0).toUpperCase() + rawGenre.slice(1).toLowerCase();
                const color = this.colorScales.genre(primaryGenre);
                console.log(`🎭 Genre color for "${node.title}": ${rawGenre} -> ${primaryGenre} -> ${color}`);
                return color;
            
            case 'year':
                // Year is always available
                const decade = this.getDecade(node.year);
                return this.colorScales.year(decade);
            
            case 'popularity':
                // Check if popularity data is available
                if (!details.stats?.watchers && !node.fullDetails) {
                    return '#666666'; // Gray for missing data
                }
                const watchers = details.stats?.watchers || 0;
                return this.colorScales.popularity(watchers);
            
            case 'runtime':
                // Check if runtime data is available
                if (!details.runtime && !node.fullDetails) {
                    return '#666666'; // Gray for missing data
                }
                const runtime = details.runtime || 90;
                return this.colorScales.runtime(runtime);
            
            default:
                return this.colorScales.depth(Math.min(node.depth, 3));
        }
    }

    // Helper function to get decade from year
    getDecade(year) {
        const decade = Math.floor(year / 10) * 10;
        return `${decade}s`;
    }

    // Change color mode and update visualization
    setColorMode(mode) {
        this.colorMode = mode;
        this.currentColorMode = mode; // Store the current mode for cross-category awareness
        this.updateVisualization();
        
        // Show notification about color change and data availability
        const modeNames = {
            depth: 'Network Depth',
            rating: 'Movie Rating',
            genre: 'Primary Genre',
            year: 'Release Decade',
            popularity: 'Popularity (Watchers)',
            runtime: 'Movie Runtime'
        };
        
        // Check how many nodes have the required data
        const dataAvailability = this.checkDataAvailability(mode);
        let message = `Color mode: ${modeNames[mode]}`;
        
        if (dataAvailability.missing > 0) {
            message += ` (${dataAvailability.missing} movies need details loaded)`;
        }
        
        ui.showNotification(message, dataAvailability.missing > 0 ? 'warning' : 'success');
        
        // Update legend with current visible nodes (maintains cross-category awareness)
        const visibleNodes = this.currentVisibleNodes || this.nodes;
        this.updateColorLegend(mode, visibleNodes);
    }

    // Update the color legend based on current mode
    updateColorLegend(mode, filteredNodes = null) {
        const sidebar = document.getElementById('colorModeSidebar');
        const legendTitle = document.getElementById('legendTitle');
        const legendContent = document.getElementById('legendContent');
        
        if (!sidebar || !legendTitle || !legendContent) return;
        
        const modeNames = {
            depth: 'Network Depth',
            rating: 'Movie Rating',
            genre: 'Primary Genre', 
            year: 'Release Decade',
            popularity: 'Popularity (Watchers)',
            runtime: 'Movie Runtime'
        };
        
        legendTitle.textContent = modeNames[mode] || 'Color Legend';
        
        let legendHTML = '';
        
        // Generate legend based on current visible nodes for database-like filtering
        const currentVisibleNodes = filteredNodes || this.currentVisibleNodes || this.nodes;
        legendHTML = this.generateDynamicLegend(mode, currentVisibleNodes);
        
        console.log(`🔧 Generating legend for ${mode} with ${currentVisibleNodes.length} visible nodes`);
        
        legendContent.innerHTML = legendHTML;
        sidebar.style.display = 'block';
        
        // Add click handlers to legend items for filtering (after content is set)
        console.log('🔧 Legend HTML generated for filtered data:', legendHTML);
        console.log('🔧 Legend content element:', legendContent);
        
        // Set up interactivity immediately without delay
        console.log('🔧 Setting up legend interactivity...');
        this.setupLegendInteractivity(mode);
        
        // Restore visual selection state immediately after
        console.log('🔧 Restoring selection state for mode:', mode);
        this.restoreSelectionVisualState(mode);
    }

    // Check data availability for color modes
    checkDataAvailability(mode) {
        let available = 0;
        let missing = 0;
        
        this.nodes.forEach(node => {
            const details = node.fullDetails || node.basicDetails || {};
            let hasData = false;
            
            switch (mode) {
                case 'depth':
                case 'year':
                    hasData = true; // Always available
                    break;
                case 'genre':
                    hasData = !!details.genres?.length || !!node.fullDetails;
                    break;
                case 'rating':
                    hasData = !!details.rating || !!node.fullDetails;
                    break;
                case 'popularity':
                    hasData = !!details.stats?.watchers || !!node.fullDetails;
                    break;
                case 'runtime':
                    hasData = !!details.runtime || !!node.fullDetails;
                    break;
            }
            
            if (hasData) available++;
            else missing++;
        });
        
        return { available, missing };
    }

    // Load all missing details for current color mode
    async loadMissingDetailsForColorMode() {
        const mode = this.colorMode;
        const nodesToLoad = [];
        
        this.nodes.forEach(node => {
            if (!node.fullDetails) {
                const details = node.basicDetails || {};
                let needsDetails = false;
                
                switch (mode) {
                    case 'genre':
                        needsDetails = !details.genres?.length;
                        break;
                    case 'rating':
                        needsDetails = !details.rating;
                        break;
                    case 'popularity':
                        needsDetails = !details.stats?.watchers;
                        break;
                    case 'runtime':
                        needsDetails = !details.runtime;
                        break;
                }
                
                if (needsDetails) {
                    nodesToLoad.push(node);
                }
            }
        });
        
        if (nodesToLoad.length > 0) {
            ui.showLoading(true);
            ui.showNotification(`Loading details for ${nodesToLoad.length} movies...`);
            
            try {
                for (const node of nodesToLoad) {
                    const fullDetails = await api.getFullMovieDetails(node.traktId);
                    if (fullDetails) {
                        node.fullDetails = fullDetails;
                    }
                }
                
                this.updateVisualization();
                ui.updateSidebar(this.nodes);
                ui.showNotification(`Loaded details for ${nodesToLoad.length} movies!`, 'success');
                
            } catch (error) {
                ui.showNotification('Failed to load some movie details', 'error');
            } finally {
                ui.showLoading(false);
            }
        }
    }

    // Setup interactive legend for filtering
    setupLegendInteractivity(mode) {
        // Initialize selected filters for this mode
        if (!this.selectedFilters) this.selectedFilters = {};
        if (!this.selectedFilters[mode]) this.selectedFilters[mode] = new Set();
        
        // Get legend items from the specific legend content area
        const legendContent = document.getElementById('legendContent');
        if (!legendContent) {
            console.log('❌ Legend content not found');
            return;
        }
        
        const legendItems = legendContent.querySelectorAll('.legend-item');
        console.log(`🔧 Setting up interactivity for ${legendItems.length} legend items`);
        
        legendItems.forEach((item, index) => {
            console.log(`🔍 Processing item ${index}:`, item.textContent, item);
            
            // Skip "No data" items
            if (item.textContent.includes('No ') || item.textContent.includes('data')) {
                console.log(`⏭️ Skipping item ${index}: ${item.textContent}`);
                return;
            }
            
            console.log(`✅ Setting up item ${index}: ${item.textContent}`);
            
            // Remove any existing event listeners by cloning the element
            const newItem = item.cloneNode(true);
            item.parentNode.replaceChild(newItem, item);
            
            // Add hover effect
            newItem.style.cursor = 'pointer';
            newItem.style.transition = 'all 0.2s ease';
            newItem.dataset.filterValue = newItem.textContent.trim();
            
            // Add click handler with immediate visual feedback
            newItem.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log(`🖱️ Clicked legend item: ${newItem.textContent}`);
                
                // Immediate visual feedback
                const stableKey = this.extractStableFilterKey(mode, newItem.textContent.trim());
                const isSelected = this.selectedFilters[mode] && this.selectedFilters[mode].has(stableKey);
                
                if (isSelected) {
                    newItem.classList.remove('selected');
                    newItem.style.background = 'transparent';
                    newItem.style.border = 'none';
                    newItem.style.padding = '0';
                } else {
                    newItem.classList.add('selected');
                    newItem.style.background = 'rgba(233, 69, 96, 0.2)';
                    newItem.style.border = '1px solid var(--accent-color)';
                    newItem.style.borderRadius = '4px';
                    newItem.style.padding = '2px 4px';
                }
                
                // Process the filter change
                this.toggleLegendFilter(mode, newItem);
            }, { passive: false });
            
            // Add hover effects (only if not selected)
            item.addEventListener('mouseenter', (e) => {
                console.log(`🖱️ Hovering legend item: ${item.textContent}`);
                if (!item.classList.contains('selected')) {
                    item.style.background = 'rgba(255, 255, 255, 0.1)';
                    item.style.borderRadius = '4px';
                    item.style.padding = '2px 4px';
                }
                
                // Preview combined filter using stable key
                const stableKey = this.extractStableFilterKey(mode, item.textContent.trim());
                this.previewCombinedFilter(mode, stableKey);
            });
            
            item.addEventListener('mouseleave', (e) => {
                console.log(`🖱️ Left legend item: ${item.textContent}`);
                if (!item.classList.contains('selected')) {
                    item.style.background = 'transparent';
                    item.style.padding = '0';
                }
                
                // Only reapply filters if there are active selections, otherwise just clear preview highlighting
                const hasActiveFilters = Object.values(this.selectedFilters || {}).some(filterSet => filterSet.size > 0);
                if (hasActiveFilters) {
                    this.applyAllCategoryFilters();
                } else {
                    this.clearHighlight();
                }
            });
        });
        
        // Add clear all button
        this.addClearAllButton(mode);
    }

    // Toggle legend filter selection
    toggleLegendFilter(mode, item) {
        // Initialize selectedFilters if not exists
        if (!this.selectedFilters) {
            this.selectedFilters = {
                depth: new Set(),
                genre: new Set(),
                year: new Set(),
                rating: new Set(),
                popularity: new Set(),
                runtime: new Set()
            };
        }
        
        // Extract the stable filter key (without count)
        const stableFilterKey = this.extractStableFilterKey(mode, item.textContent.trim());
        console.log(`🔧 Toggle filter - Mode: ${mode}, Key: ${stableFilterKey}, Text: ${item.textContent.trim()}`);
        
        // Toggle the filter state
        if (this.selectedFilters[mode].has(stableFilterKey)) {
            // Deselect
            this.selectedFilters[mode].delete(stableFilterKey);
            console.log(`❌ Deselected: ${stableFilterKey}`);
        } else {
            // Select
            this.selectedFilters[mode].add(stableFilterKey);
            console.log(`✅ Selected: ${stableFilterKey}`);
        }
        
        // Store the stable key for restoration
        item.dataset.stableKey = stableFilterKey;
        
        // Debug current state
        console.log(`🔍 Current filters for ${mode}:`, Array.from(this.selectedFilters[mode]));
        console.log(`🔍 All filters:`, Object.fromEntries(
            Object.entries(this.selectedFilters).map(([k, v]) => [k, Array.from(v)])
        ));
        
        // Apply combined filter
        this.applyCombinedFilter(mode);
    }

    // Apply combined filter from all selected items across ALL categories
    applyCombinedFilter(mode) {
        // Apply filters from all categories, not just the current one
        this.applyAllCategoryFilters();
    }
    
    // Apply filters from all categories that have selections
    applyAllCategoryFilters() {
        console.log(`🔧 applyAllCategoryFilters called`);
        
        if (!this.selectedFilters) {
            console.log(`⚠️ No selectedFilters object found`);
            return;
        }
        
        // Check if any category has active filters
        const hasAnyFilters = Object.values(this.selectedFilters).some(filterSet => filterSet.size > 0);
        console.log(`🔍 Has any filters: ${hasAnyFilters}`);
        
        if (!hasAnyFilters) {
            console.log(`🔄 No filters active, restoring all nodes`);
            this.restoreAllNodes();
            ui.showNotification('All filters cleared - showing all nodes', 'info');
            return;
        }
        
        // Start with all nodes and apply each category's filters
        let filteredNodes = this.originalNodes || this.nodes;
        const activeFilters = [];
        
        console.log(`🔧 Starting with ${filteredNodes.length} nodes`);
        
        // Apply filters from each category (AND logic between categories)
        Object.entries(this.selectedFilters).forEach(([category, filterSet]) => {
            if (filterSet.size > 0) {
                console.log(`🔍 Applying ${category} filters:`, Array.from(filterSet));
                
                // Within each category, use OR logic
                const categoryMatches = filteredNodes.filter(node => {
                    return Array.from(filterSet).some(stableKey => {
                        const filterValue = this.stableKeyToFilterValue(category, stableKey);
                        const matches = this.nodeMatchesFilter(node, category, filterValue, stableKey);
                        if (matches) {
                            console.log(`✅ Node ${node.title} matches ${category}: ${stableKey}`);
                        }
                        return matches;
                    });
                });
                
                console.log(`🔍 ${category} filter: ${categoryMatches.length} matches from ${filteredNodes.length} nodes`);
                filteredNodes = categoryMatches;
                activeFilters.push(`${category}: ${Array.from(filterSet).join(', ')}`);
            }
        });
        
        console.log(`🔍 Multi-category filter: ${filteredNodes.length} nodes match criteria from ${activeFilters.length} categories`);
        
        // Filter network to show only matching nodes
        this.filterNetworkNodes(filteredNodes);
        
        // Show notification with all active filters
        const totalNodes = this.originalNodes ? this.originalNodes.length : this.nodes.length;
        const hiddenCount = totalNodes - filteredNodes.length;
        ui.showNotification(`Showing ${filteredNodes.length} movies, ${hiddenCount} hidden | Active: ${activeFilters.join(' + ')}`, 'info');
        
        // Update visual indicators for active filters
        this.updateCategoryFilterIndicators();
        
        // Update active filters display
        this.updateActiveFiltersDisplay(filteredNodes);
        
        // Update all category legends to reflect current filtered state (but avoid double updates)
        if (!this.isUpdatingLegend) {
            this.updateAllCategoryLegends(filteredNodes);
        }
        
        // Force update the current legend with filtered data
        const currentMode = this.currentColorMode || this.colorMode || 'depth';
        this.updateColorLegend(currentMode, filteredNodes);
    }

    // Preview combined filter including hovered item (just highlight, don't remove)
    previewCombinedFilter(mode, hoveredText) {
        const previewFilters = new Set(this.selectedFilters[mode]);
        previewFilters.add(hoveredText);
        
        const matchingNodes = this.nodes.filter(node => {
            return Array.from(previewFilters).some(stableKey => {
                const filterValue = this.stableKeyToFilterValue(mode, stableKey);
                return this.nodeMatchesFilter(node, mode, filterValue, stableKey);
            });
        });
        
        // Only highlight for preview, don't actually remove nodes
        this.highlightFilteredNodes(matchingNodes);
    }

    // Add clear all button to legend
    addClearAllButton(mode) {
        const legendContent = document.getElementById('legendContent');
        if (!legendContent) return;
        
        // Remove existing clear button
        const existingClear = legendContent.querySelector('.clear-filters-btn');
        if (existingClear) existingClear.remove();
        
        // Add clear all button
        const clearBtn = document.createElement('div');
        clearBtn.className = 'clear-filters-btn';
        clearBtn.innerHTML = '🗑️ Clear All Filters';
        clearBtn.style.cssText = `
            margin-top: 10px;
            padding: 6px 8px;
            background: var(--glass-bg);
            border: 1px solid var(--glass-border);
            border-radius: 4px;
            cursor: pointer;
            text-align: center;
            font-size: 11px;
            color: var(--text-secondary);
            transition: all 0.2s ease;
        `;
        
        clearBtn.addEventListener('click', () => {
            this.clearAllFilters(mode);
        });
        
        clearBtn.addEventListener('mouseenter', () => {
            clearBtn.style.background = 'rgba(233, 69, 96, 0.1)';
            clearBtn.style.borderColor = 'var(--accent-color)';
            clearBtn.style.color = 'var(--accent-color)';
        });
        
        clearBtn.addEventListener('mouseleave', () => {
            clearBtn.style.background = 'var(--glass-bg)';
            clearBtn.style.borderColor = 'var(--glass-border)';
            clearBtn.style.color = 'var(--text-secondary)';
        });
        
        legendContent.appendChild(clearBtn);
    }

    // Clear all filters for current mode
    clearAllFilters(mode) {
        this.selectedFilters[mode].clear();
        
        // Remove selected styling from all items
        document.querySelectorAll('.legend-item.selected').forEach(item => {
            item.classList.remove('selected');
            item.style.background = 'transparent';
            item.style.border = 'none';
            item.style.padding = '0';
        });
        
        this.applyAllCategoryFilters();
    }

    // Clear all filters across all categories
    clearAllFiltersGlobal() {
        if (!this.selectedFilters) return;
        
        // Clear all filter sets
        Object.keys(this.selectedFilters).forEach(mode => {
            this.selectedFilters[mode].clear();
        });
        
        // Remove selected styling from all items
        document.querySelectorAll('.legend-item.selected').forEach(item => {
            item.classList.remove('selected');
            item.style.background = 'transparent';
            item.style.border = 'none';
            item.style.padding = '0';
        });
        
        // Restore all nodes
        this.restoreAllNodes();
        
        // Update indicators
        this.updateCategoryFilterIndicators();
        
        ui.showNotification('All filters cleared across all categories', 'info');
    }

    // Filter network to hide non-matching nodes (make them disappear visually)
    filterNetworkNodes(matchingNodes) {
        if (!this.svg) return;
        
        const matchingIds = new Set(matchingNodes.map(n => n.id));
        
        // Hide/show nodes based on filter
        this.svg.selectAll('.node')
            .style('opacity', d => matchingIds.has(d.id) ? 1 : 0)
            .style('pointer-events', d => matchingIds.has(d.id) ? 'all' : 'none');
        
        // Hide/show links - only show links between visible nodes
        this.svg.selectAll('.link')
            .style('opacity', d => {
                const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
                const targetId = typeof d.target === 'object' ? d.target.id : d.target;
                return matchingIds.has(sourceId) && matchingIds.has(targetId) ? 0.6 : 0;
            });
        
        // Hide/show labels if they're visible
        if (this.showLabels) {
            this.svg.selectAll('.node-label')
                .style('opacity', d => matchingIds.has(d.id) ? 1 : 0);
        }
        
        // Update sidebar to show only filtered movies
        if (window.ui && window.ui.renderSidebarMovies) {
            window.ui.renderSidebarMovies(matchingNodes);
        }
        
        // Store current visible nodes for cross-category awareness
        this.currentVisibleNodes = matchingNodes;
    }
    
    // Restore all nodes to the visualization (make them all visible again)
    restoreAllNodes() {
        if (!this.svg) return;
        
        // Show all nodes
        this.svg.selectAll('.node')
            .style('opacity', 1)
            .style('pointer-events', 'all');
        
        // Show all links
        this.svg.selectAll('.link')
            .style('opacity', 0.6);
        
        // Show all labels if they're visible
        if (this.showLabels) {
            this.svg.selectAll('.node-label')
                .style('opacity', 1);
        }
        
        // Clear highlighting
        this.clearHighlight();
        
        // Update sidebar to show all movies
        if (window.ui && window.ui.renderSidebarMovies) {
            const allNodes = this.originalNodes || this.nodes;
            window.ui.renderSidebarMovies(allNodes);
        }
        
        // Update all category legends to reflect full dataset
        this.updateAllCategoryLegends(this.originalNodes || this.nodes);
        
        // Update active filters display
        this.updateActiveFiltersDisplay(this.originalNodes || this.nodes);
    }
    
    // Extract stable filter key (without changing counts)
    extractStableFilterKey(mode, legendText) {
        switch (mode) {
            case 'depth':
                // Extract just the depth number: "Depth 1 (5 movies) - Direct connections" -> "Depth 1"
                const depthMatch = legendText.match(/Depth (\d+)/);
                return depthMatch ? `Depth ${depthMatch[1]}` : legendText;
                
            case 'genre':
                // Extract genre name: "Action (10 movies)" -> "Action"
                const genreMatch = legendText.match(/^([^(]+)/);
                return genreMatch ? genreMatch[1].trim() : legendText;
                
            case 'year':
                // Extract decade: "2000s (8 movies)" -> "2000s"
                const yearMatch = legendText.match(/^(\d{4}s)/);
                return yearMatch ? yearMatch[1] : legendText;
                
            case 'rating':
                // Extract rating range: "Excellent (7-10) - 5 movies" -> "Excellent (7-10)"
                const ratingMatch = legendText.match(/^([^-]+)/);
                return ratingMatch ? ratingMatch[1].trim() : legendText;
                
            case 'popularity':
                // Extract popularity level: "Low popularity - 7 movies" -> "Low popularity"
                const popularityMatch = legendText.match(/^([^-]+)/);
                return popularityMatch ? popularityMatch[1].trim() : legendText;
                
            case 'runtime':
                // Extract runtime range: "Short (60-90 min) - 3 movies" -> "Short (60-90 min)"
                const runtimeMatch = legendText.match(/^([^-]+)/);
                return runtimeMatch ? runtimeMatch[1].trim() : legendText;
                
            default:
                return legendText;
        }
    }

    // Convert stable key back to filter value for node matching
    stableKeyToFilterValue(mode, stableKey) {
        switch (mode) {
            case 'depth':
                // "Depth 1" -> extract "1"
                const depthMatch = stableKey.match(/Depth (\d+)/);
                return depthMatch ? parseInt(depthMatch[1]) : stableKey;
                
            case 'genre':
                // "Action" -> "Action"
                return stableKey;
                
            case 'year':
                // "2000s" -> "2000s"
                return stableKey;
                
            case 'rating':
                // "Excellent (8.5-10)" -> determine range
                if (stableKey.includes('Poor')) return 'poor';
                if (stableKey.includes('Average')) return 'average';
                if (stableKey.includes('Good')) return 'good';
                if (stableKey.includes('Excellent')) return 'excellent';
                return stableKey;
                
            case 'popularity':
                // "Low popularity" -> "low"
                if (stableKey.includes('Low')) return 'low';
                if (stableKey.includes('Medium')) return 'medium';
                if (stableKey.includes('High') && !stableKey.includes('Very')) return 'high';
                if (stableKey.includes('Very')) return 'very_popular';
                return stableKey;
                
            case 'runtime':
                // "Short (60-90 min)" -> "short"
                if (stableKey.includes('Short')) return 'short';
                if (stableKey.includes('Medium')) return 'medium';
                if (stableKey.includes('Long') && !stableKey.includes('Very')) return 'long';
                if (stableKey.includes('Very')) return 'very_long';
                return stableKey;
                
            default:
                return stableKey;
        }
    }

    // Update visual indicators for categories that have active filters
    updateCategoryFilterIndicators() {
        if (!this.selectedFilters) return;
        
        // Update each color mode button to show if it has active filters
        document.querySelectorAll('.color-mode-btn').forEach(btn => {
            const mode = btn.dataset.mode;
            const hasFilters = this.selectedFilters[mode] && this.selectedFilters[mode].size > 0;
            
            if (hasFilters) {
                btn.classList.add('has-filters');
                // Add a small indicator
                if (!btn.querySelector('.filter-indicator')) {
                    const indicator = document.createElement('div');
                    indicator.className = 'filter-indicator';
                    indicator.style.cssText = `
                        position: absolute;
                        top: 4px;
                        right: 4px;
                        width: 8px;
                        height: 8px;
                        background: var(--accent-color);
                        border-radius: 50%;
                        border: 1px solid white;
                    `;
                    btn.appendChild(indicator);
                }
            } else {
                btn.classList.remove('has-filters');
                const indicator = btn.querySelector('.filter-indicator');
                if (indicator) {
                    indicator.remove();
                }
            }
        });
    }

    // Update the active filters display box
    updateActiveFiltersDisplay(visibleNodes) {
        const filtersList = document.getElementById('filtersList');
        const filterStats = document.getElementById('filterStats');
        const clearAllBtn = document.getElementById('clearAllFiltersBtn');
        
        if (!filtersList || !filterStats || !clearAllBtn) return;
        
        const totalNodes = this.originalNodes ? this.originalNodes.length : this.nodes.length;
        const visibleCount = visibleNodes ? visibleNodes.length : totalNodes;
        
        // Check if any filters are active
        const activeFilters = [];
        let hasAnyFilters = false;
        
        if (this.selectedFilters) {
            Object.entries(this.selectedFilters).forEach(([category, filterSet]) => {
                if (filterSet.size > 0) {
                    hasAnyFilters = true;
                    const categoryName = {
                        depth: 'Depth',
                        genre: 'Genre',
                        year: 'Year',
                        rating: 'Rating',
                        popularity: 'Popularity',
                        runtime: 'Runtime'
                    }[category] || category;
                    
                    const filters = Array.from(filterSet).join(', ');
                    activeFilters.push(`<div style="margin-bottom: 3px;"><strong>${categoryName}:</strong> ${filters}</div>`);
                }
            });
        }
        
        // Update display
        if (hasAnyFilters) {
            filtersList.innerHTML = activeFilters.join('');
            filterStats.textContent = `${visibleCount} / ${totalNodes} movies`;
            clearAllBtn.style.display = 'inline-block';
        } else {
            filtersList.innerHTML = 'No filters active';
            filterStats.textContent = `${totalNodes} / ${totalNodes} movies`;
            clearAllBtn.style.display = 'none';
        }
        
        console.log(`📊 Filter Display Updated: ${visibleCount}/${totalNodes} movies, ${activeFilters.length} categories active`);
    }

    // Update all category legends to show counts based on currently visible nodes
    updateAllCategoryLegends(visibleNodes) {
        if (!visibleNodes || visibleNodes.length === 0) return;
        
        // Prevent recursive updates
        if (this.isUpdatingLegend) return;
        this.isUpdatingLegend = true;
        
        // Store the current visible nodes for legend generation
        this.currentVisibleNodes = visibleNodes;
        
        // Get current active mode - use the stored mode or fall back to colorMode
        const currentMode = this.currentColorMode || this.colorMode || 'depth';
        
        // Update the current legend with filtered data
        this.updateColorLegend(currentMode, visibleNodes);
        
        // Reset the flag after a delay
        setTimeout(() => {
            this.isUpdatingLegend = false;
        }, 200);
    }

    // Restore visual selection state for legend items
    restoreSelectionVisualState(mode) {
        if (!this.selectedFilters || !this.selectedFilters[mode]) return;
        
        const selectedKeys = this.selectedFilters[mode];
        if (selectedKeys.size === 0) return;
        
        // Find and mark selected legend items using stable keys
        document.querySelectorAll('.legend-item').forEach(item => {
            const legendText = item.textContent.trim();
            const stableKey = this.extractStableFilterKey(mode, legendText);
            
            if (selectedKeys.has(stableKey)) {
                item.classList.add('selected');
                item.style.background = 'rgba(233, 69, 96, 0.2)';
                item.style.border = '1px solid var(--accent-color)';
                item.style.borderRadius = '4px';
                item.style.padding = '2px 4px';
                item.dataset.stableKey = stableKey;
                
                console.log(`🔄 Restored selection for: ${stableKey} (from text: ${legendText})`);
            }
        });
    }

    // Generate dynamic legend based on actual data in the network
    generateDynamicLegend(mode, nodesToAnalyze = null) {
        const dataAnalysis = this.analyzeNetworkData(mode, nodesToAnalyze);
        let legendHTML = '';
        
        switch (mode) {
            case 'depth':
                // Show only depths that exist in the network
                dataAnalysis.depths.forEach(depth => {
                    const count = dataAnalysis.depthCounts[depth];
                    const color = this.colorScales.depth(Math.min(depth, 3));
                    const label = depth === 0 ? 'Your searches' : 
                                 depth === 1 ? 'Direct connections' :
                                 depth === 2 ? 'Second level' : 'Further levels';
                    legendHTML += `<div class="legend-item"><span class="legend-color" style="background: ${color};"></span> Depth ${depth} (${count} movies) - ${label}</div>`;
                });
                break;
                
            case 'genre':
                // Show only genres that exist in the network
                dataAnalysis.genres.forEach(genre => {
                    const count = dataAnalysis.genreCounts[genre];
                    const color = this.colorScales.genre(genre);
                    legendHTML += `<div class="legend-item"><span class="legend-color" style="background: ${color};"></span> ${genre} (${count} movies)</div>`;
                });
                if (dataAnalysis.missingGenres > 0) {
                    legendHTML += `<div class="legend-item"><span class="legend-color" style="background: #666666;"></span> No genre data (${dataAnalysis.missingGenres} movies)</div>`;
                }
                break;
                
            case 'year':
                // Show only decades that exist in the network
                dataAnalysis.decades.forEach(decade => {
                    const count = dataAnalysis.decadeCounts[decade];
                    const color = this.colorScales.year(decade);
                    legendHTML += `<div class="legend-item"><span class="legend-color" style="background: ${color};"></span> ${decade} (${count} movies)</div>`;
                });
                break;
                
            case 'rating':
                // Show rating ranges based on actual data with more defined excellent range
                if (dataAnalysis.ratingRanges.poor > 0) {
                    legendHTML += `<div class="legend-item"><span class="legend-color" style="background: #d73027;"></span> Poor (0-5) - ${dataAnalysis.ratingRanges.poor} movies</div>`;
                }
                if (dataAnalysis.ratingRanges.average > 0) {
                    legendHTML += `<div class="legend-item"><span class="legend-color" style="background: #fee08b;"></span> Average (5-7) - ${dataAnalysis.ratingRanges.average} movies</div>`;
                }
                if (dataAnalysis.ratingRanges.good > 0) {
                    legendHTML += `<div class="legend-item"><span class="legend-color" style="background: #74c476;"></span> Good (7-8.5) - ${dataAnalysis.ratingRanges.good} movies</div>`;
                }
                if (dataAnalysis.ratingRanges.excellent > 0) {
                    legendHTML += `<div class="legend-item"><span class="legend-color" style="background: #238b45;"></span> Excellent (8.5-10) - ${dataAnalysis.ratingRanges.excellent} movies</div>`;
                }
                if (dataAnalysis.missingRatings > 0) {
                    legendHTML += `<div class="legend-item"><span class="legend-color" style="background: #666666;"></span> No rating data (${dataAnalysis.missingRatings} movies)</div>`;
                }
                break;
                
            case 'popularity':
                // Show popularity ranges based on actual data
                if (dataAnalysis.popularityRanges.low > 0) {
                    legendHTML += `<div class="legend-item"><span class="legend-color" style="background: ${this.colorScales.popularity(5000)};"></span> Low popularity - ${dataAnalysis.popularityRanges.low} movies</div>`;
                }
                if (dataAnalysis.popularityRanges.medium > 0) {
                    legendHTML += `<div class="legend-item"><span class="legend-color" style="background: ${this.colorScales.popularity(25000)};"></span> Medium popularity - ${dataAnalysis.popularityRanges.medium} movies</div>`;
                }
                if (dataAnalysis.popularityRanges.high > 0) {
                    legendHTML += `<div class="legend-item"><span class="legend-color" style="background: ${this.colorScales.popularity(50000)};"></span> High popularity - ${dataAnalysis.popularityRanges.high} movies</div>`;
                }
                if (dataAnalysis.popularityRanges.very_popular > 0) {
                    legendHTML += `<div class="legend-item"><span class="legend-color" style="background: ${this.colorScales.popularity(80000)};"></span> Very popular - ${dataAnalysis.popularityRanges.very_popular} movies</div>`;
                }
                if (dataAnalysis.missingPopularity > 0) {
                    legendHTML += `<div class="legend-item"><span class="legend-color" style="background: #666666;"></span> No popularity data (${dataAnalysis.missingPopularity} movies)</div>`;
                }
                break;
                
            case 'runtime':
                // Show runtime ranges based on actual data
                if (dataAnalysis.runtimeRanges.short > 0) {
                    legendHTML += `<div class="legend-item"><span class="legend-color" style="background: ${this.colorScales.runtime(75)};"></span> Short (60-90 min) - ${dataAnalysis.runtimeRanges.short} movies</div>`;
                }
                if (dataAnalysis.runtimeRanges.medium > 0) {
                    legendHTML += `<div class="legend-item"><span class="legend-color" style="background: ${this.colorScales.runtime(105)};"></span> Medium (90-120 min) - ${dataAnalysis.runtimeRanges.medium} movies</div>`;
                }
                if (dataAnalysis.runtimeRanges.long > 0) {
                    legendHTML += `<div class="legend-item"><span class="legend-color" style="background: ${this.colorScales.runtime(135)};"></span> Long (120-150 min) - ${dataAnalysis.runtimeRanges.long} movies</div>`;
                }
                if (dataAnalysis.runtimeRanges.very_long > 0) {
                    legendHTML += `<div class="legend-item"><span class="legend-color" style="background: ${this.colorScales.runtime(165)};"></span> Very long (150+ min) - ${dataAnalysis.runtimeRanges.very_long} movies</div>`;
                }
                if (dataAnalysis.missingRuntime > 0) {
                    legendHTML += `<div class="legend-item"><span class="legend-color" style="background: #666666;"></span> No runtime data (${dataAnalysis.missingRuntime} movies)</div>`;
                }
                break;
        }
        
        return legendHTML;
    }

    // Analyze network data to determine what legend items to show
    analyzeNetworkData(mode, nodesToAnalyze = null) {
        const analysis = {
            depths: new Set(),
            depthCounts: {},
            genres: new Set(),
            genreCounts: {},
            decades: new Set(),
            decadeCounts: {},
            ratingRanges: { poor: 0, average: 0, good: 0, excellent: 0 },
            popularityRanges: { low: 0, medium: 0, high: 0, very_popular: 0 },
            runtimeRanges: { short: 0, medium: 0, long: 0, very_long: 0 },
            missingGenres: 0,
            missingRatings: 0,
            missingPopularity: 0,
            missingRuntime: 0
        };
        
        // Use provided nodes or fall back to current visible nodes for accurate counts
        const nodes = nodesToAnalyze || this.currentVisibleNodes || this.nodes;
        
        nodes.forEach(node => {
            const details = node.fullDetails || node.basicDetails || {};
            
            // Analyze depth
            analysis.depths.add(node.depth);
            analysis.depthCounts[node.depth] = (analysis.depthCounts[node.depth] || 0) + 1;
            
            // Analyze genres
            if (details.genres?.length) {
                const rawGenre = details.genres[0];
                const primaryGenre = rawGenre.charAt(0).toUpperCase() + rawGenre.slice(1).toLowerCase();
                analysis.genres.add(primaryGenre);
                analysis.genreCounts[primaryGenre] = (analysis.genreCounts[primaryGenre] || 0) + 1;
            } else {
                analysis.missingGenres++;
            }
            
            // Analyze decades
            const decade = this.getDecade(node.year);
            analysis.decades.add(decade);
            analysis.decadeCounts[decade] = (analysis.decadeCounts[decade] || 0) + 1;
            
            // Analyze ratings - More defined excellent range
            if (details.rating) {
                if (details.rating < 5) analysis.ratingRanges.poor++;
                else if (details.rating < 7) analysis.ratingRanges.average++;
                else if (details.rating < 8.5) analysis.ratingRanges.good++;
                else analysis.ratingRanges.excellent++;
            } else {
                analysis.missingRatings++;
            }
            
            // Analyze popularity
            if (details.stats?.watchers) {
                const watchers = details.stats.watchers;
                if (watchers < 15000) analysis.popularityRanges.low++;
                else if (watchers < 40000) analysis.popularityRanges.medium++;
                else if (watchers < 70000) analysis.popularityRanges.high++;
                else analysis.popularityRanges.very_popular++;
            } else {
                analysis.missingPopularity++;
            }
            
            // Analyze runtime
            if (details.runtime) {
                const runtime = details.runtime;
                if (runtime < 90) analysis.runtimeRanges.short++;
                else if (runtime < 120) analysis.runtimeRanges.medium++;
                else if (runtime < 150) analysis.runtimeRanges.long++;
                else analysis.runtimeRanges.very_long++;
            } else {
                analysis.missingRuntime++;
            }
        });
        
        // Convert sets to sorted arrays
        analysis.depths = Array.from(analysis.depths).sort((a, b) => a - b);
        analysis.genres = Array.from(analysis.genres).sort();
        analysis.decades = Array.from(analysis.decades).sort();
        
        return analysis;
    }

    // Extract filter value from legend text
    extractFilterValue(mode, legendText) {
        console.log(`🔍 Extracting filter value for mode "${mode}" from text: "${legendText}"`);
        
        switch (mode) {
            case 'depth':
                if (legendText.includes('Depth 0')) return 0;
                if (legendText.includes('Depth 1')) return 1;
                if (legendText.includes('Depth 2')) return 2;
                if (legendText.includes('Depth 3')) return 3;
                break;
                
            case 'genre':
                // Extract genre name from "Drama (27 movies)" format
                const genreMatch = legendText.match(/^([A-Za-z-]+)/);
                const genre = genreMatch ? genreMatch[1].trim() : legendText;
                console.log(`🎭 Extracted genre: "${genre}" from "${legendText}"`);
                return genre;
                
            case 'year':
                // Extract decade from "1990s (12 movies)" format
                const yearMatch = legendText.match(/^(\d{4}s)/);
                const decade = yearMatch ? yearMatch[1] : legendText;
                console.log(`📅 Extracted decade: "${decade}" from "${legendText}"`);
                return decade;
                
            case 'rating':
                if (legendText.includes('Poor')) return 'poor';
                if (legendText.includes('Average')) return 'average';
                if (legendText.includes('Excellent')) return 'excellent';
                break;
                
            case 'popularity':
                if (legendText.includes('Low')) return 'low';
                if (legendText.includes('Medium')) return 'medium';
                if (legendText.includes('High') && !legendText.includes('Very')) return 'high';
                if (legendText.includes('Very popular')) return 'very_popular';
                break;
                
            case 'runtime':
                if (legendText.includes('Short')) return 'short';
                if (legendText.includes('Medium')) return 'medium';
                if (legendText.includes('Long') && !legendText.includes('Very')) return 'long';
                if (legendText.includes('Very long')) return 'very_long';
                break;
        }
        
        console.log(`❌ No filter value extracted for "${legendText}"`);
        return null;
    }

    // Check if node matches filter criteria
    nodeMatchesFilter(node, mode, filterValue, legendText) {
        const details = node.fullDetails || node.basicDetails || {};
        
        switch (mode) {
            case 'depth':
                return node.depth === filterValue || (filterValue === 3 && node.depth >= 3);
                
            case 'genre':
                const rawGenre = details.genres?.[0] || 'Unknown';
                const primaryGenre = rawGenre.charAt(0).toUpperCase() + rawGenre.slice(1).toLowerCase();
                return primaryGenre === filterValue;
                
            case 'year':
                const decade = this.getDecade(node.year);
                return decade === filterValue;
                
            case 'rating':
                const rating = details.rating;
                if (!rating) return false;
                
                switch (filterValue) {
                    case 'poor': return rating < 5;
                    case 'average': return rating >= 5 && rating < 7;
                    case 'good': return rating >= 7 && rating < 8.5;
                    case 'excellent': return rating >= 8.5;
                }
                break;
                
            case 'popularity':
                const watchers = details.stats?.watchers;
                if (!watchers) return false;
                
                switch (filterValue) {
                    case 'low': return watchers < 15000;
                    case 'medium': return watchers >= 15000 && watchers < 40000;
                    case 'high': return watchers >= 40000 && watchers < 70000;
                    case 'very_popular': return watchers >= 70000;
                }
                break;
                
            case 'runtime':
                const runtime = details.runtime;
                if (!runtime) return false;
                
                switch (filterValue) {
                    case 'short': return runtime < 90;
                    case 'medium': return runtime >= 90 && runtime < 120;
                    case 'long': return runtime >= 120 && runtime < 150;
                    case 'very_long': return runtime >= 150;
                }
                break;
        }
        return false;
    }

    // Highlight filtered nodes
    highlightFilteredNodes(matchingNodes) {
        const matchingIds = new Set(matchingNodes.map(n => n.id));
        
        this.svg.selectAll('.node')
            .classed('highlighted', d => matchingIds.has(d.id))
            .classed('dimmed', d => !matchingIds.has(d.id));

        this.svg.selectAll('.link')
            .classed('highlighted', d => {
                const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
                const targetId = typeof d.target === 'object' ? d.target.id : d.target;
                return matchingIds.has(sourceId) && matchingIds.has(targetId);
            })
            .classed('dimmed', d => {
                const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
                const targetId = typeof d.target === 'object' ? d.target.id : d.target;
                return !matchingIds.has(sourceId) || !matchingIds.has(targetId);
            });

        if (this.showLabels) {
            this.svg.selectAll('.node-label')
                .classed('highlighted', d => matchingIds.has(d.id))
                .classed('dimmed', d => !matchingIds.has(d.id));
        }
    }
}
