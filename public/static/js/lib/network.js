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
            traktId: movie.ids.trakt,
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
            // Load full details if not already loaded
            if (!node.fullDetails) {
                const fullDetails = await api.getFullMovieDetails(node.traktId);
                if (fullDetails) {
                    node.fullDetails = fullDetails;
                    ui.updateSidebar(this.nodes);
                }

            }
            
            // Show detailed movie modal
            ui.showMovieDetailsModal(node);
            
        } catch (error) {
            ui.showNotification('Failed to load movie details', 'error');
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
            
            // Rating-based coloring (poor to excellent)
            rating: d3.scaleSequential()
                .domain([0, 10])
                .interpolator(d3.interpolateRdYlGn),
            
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
        
        // Update legend
        this.updateColorLegend(mode);
    }

    // Update the color legend based on current mode
    updateColorLegend(mode) {
        const legend = document.getElementById('colorLegend');
        const legendTitle = document.getElementById('legendTitle');
        const legendContent = document.getElementById('legendContent');
        
        if (!legend || !legendTitle || !legendContent) return;
        
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
        
        switch (mode) {
            case 'depth':
                legendHTML = `
                    <div class="legend-item"><span class="legend-color" style="background: #e94560;"></span> Depth 0 (Your searches)</div>
                    <div class="legend-item"><span class="legend-color" style="background: #f6e05e;"></span> Depth 1 (Direct connections)</div>
                    <div class="legend-item"><span class="legend-color" style="background: #10b981;"></span> Depth 2 (Second level)</div>
                    <div class="legend-item"><span class="legend-color" style="background: #3b82f6;"></span> Depth 3+ (Further levels)</div>
                `;
                break;
                
            case 'rating':
                legendHTML = `
                    <div class="legend-item"><span class="legend-color" style="background: ${this.colorScales.rating(2)};"></span> Poor (0-3)</div>
                    <div class="legend-item"><span class="legend-color" style="background: ${this.colorScales.rating(5)};"></span> Average (4-6)</div>
                    <div class="legend-item"><span class="legend-color" style="background: ${this.colorScales.rating(8)};"></span> Excellent (7-10)</div>
                    <div class="legend-item"><span class="legend-color" style="background: #666666;"></span> No rating data</div>
                `;
                break;
                
            case 'genre':
                legendHTML = `
                    <div class="legend-item"><span class="legend-color" style="background: ${this.colorScales.genre('Action')};"></span> Action</div>
                    <div class="legend-item"><span class="legend-color" style="background: ${this.colorScales.genre('Comedy')};"></span> Comedy</div>
                    <div class="legend-item"><span class="legend-color" style="background: ${this.colorScales.genre('Drama')};"></span> Drama</div>
                    <div class="legend-item"><span class="legend-color" style="background: ${this.colorScales.genre('Sci-Fi')};"></span> Sci-Fi</div>
                    <div class="legend-item"><span class="legend-color" style="background: ${this.colorScales.genre('Horror')};"></span> Horror</div>
                    <div class="legend-item"><span class="legend-color" style="background: ${this.colorScales.genre('Romance')};"></span> Romance</div>
                    <div class="legend-item"><span class="legend-color" style="background: #666666;"></span> No genre data</div>
                `;
                break;
                
            case 'year':
                legendHTML = `
                    <div class="legend-item"><span class="legend-color" style="background: ${this.colorScales.year('1920s')};"></span> 1920s</div>
                    <div class="legend-item"><span class="legend-color" style="background: ${this.colorScales.year('1930s')};"></span> 1930s</div>
                    <div class="legend-item"><span class="legend-color" style="background: ${this.colorScales.year('1940s')};"></span> 1940s</div>
                    <div class="legend-item"><span class="legend-color" style="background: ${this.colorScales.year('1950s')};"></span> 1950s</div>
                    <div class="legend-item"><span class="legend-color" style="background: ${this.colorScales.year('1960s')};"></span> 1960s</div>
                    <div class="legend-item"><span class="legend-color" style="background: ${this.colorScales.year('1970s')};"></span> 1970s</div>
                    <div class="legend-item"><span class="legend-color" style="background: ${this.colorScales.year('1980s')};"></span> 1980s</div>
                    <div class="legend-item"><span class="legend-color" style="background: ${this.colorScales.year('1990s')};"></span> 1990s</div>
                    <div class="legend-item"><span class="legend-color" style="background: ${this.colorScales.year('2000s')};"></span> 2000s</div>
                    <div class="legend-item"><span class="legend-color" style="background: ${this.colorScales.year('2010s')};"></span> 2010s</div>
                    <div class="legend-item"><span class="legend-color" style="background: ${this.colorScales.year('2020s')};"></span> 2020s</div>
                    <div class="legend-item"><span class="legend-color" style="background: ${this.colorScales.year('2030s')};"></span> 2030s</div>
                `;
                break;
                
            case 'popularity':
                legendHTML = `
                    <div class="legend-item"><span class="legend-color" style="background: ${this.colorScales.popularity(5000)};"></span> Low popularity</div>
                    <div class="legend-item"><span class="legend-color" style="background: ${this.colorScales.popularity(25000)};"></span> Medium popularity</div>
                    <div class="legend-item"><span class="legend-color" style="background: ${this.colorScales.popularity(50000)};"></span> High popularity</div>
                    <div class="legend-item"><span class="legend-color" style="background: ${this.colorScales.popularity(80000)};"></span> Very popular</div>
                    <div class="legend-item"><span class="legend-color" style="background: #666666;"></span> No popularity data</div>
                `;
                break;
                
            case 'runtime':
                legendHTML = `
                    <div class="legend-item"><span class="legend-color" style="background: ${this.colorScales.runtime(75)};"></span> Short (60-90 min)</div>
                    <div class="legend-item"><span class="legend-color" style="background: ${this.colorScales.runtime(105)};"></span> Medium (90-120 min)</div>
                    <div class="legend-item"><span class="legend-color" style="background: ${this.colorScales.runtime(135)};"></span> Long (120-150 min)</div>
                    <div class="legend-item"><span class="legend-color" style="background: ${this.colorScales.runtime(165)};"></span> Very long (150+ min)</div>
                    <div class="legend-item"><span class="legend-color" style="background: #666666;"></span> No runtime data</div>
                `;
                break;
        }
        
        legendContent.innerHTML = legendHTML;
        legend.style.display = 'block';
        
        // Add click handlers to legend items for filtering
        this.setupLegendInteractivity(mode);
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
        
        const legendItems = document.querySelectorAll('.legend-item');
        
        legendItems.forEach(item => {
            // Skip "No data" items
            if (item.textContent.includes('No ') || item.textContent.includes('data')) {
                return;
            }
            
            // Add hover effect
            item.style.cursor = 'pointer';
            item.style.transition = 'all 0.2s ease';
            item.dataset.filterValue = item.textContent.trim();
            
            // Add click handler for multi-selection
            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleLegendFilter(mode, item);
            });
            
            // Add hover effects (only if not selected)
            item.addEventListener('mouseenter', () => {
                if (!item.classList.contains('selected')) {
                    item.style.background = 'rgba(255, 255, 255, 0.1)';
                    item.style.borderRadius = '4px';
                    item.style.padding = '2px 4px';
                }
                
                // Preview combined filter
                this.previewCombinedFilter(mode, item.textContent.trim());
            });
            
            item.addEventListener('mouseleave', () => {
                if (!item.classList.contains('selected')) {
                    item.style.background = 'transparent';
                    item.style.padding = '0';
                }
                
                // Show current selection or clear
                if (this.selectedFilters[mode].size > 0) {
                    this.applyCombinedFilter(mode);
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
        const filterValue = item.dataset.filterValue;
        
        if (this.selectedFilters[mode].has(filterValue)) {
            // Deselect
            this.selectedFilters[mode].delete(filterValue);
            item.classList.remove('selected');
            item.style.background = 'transparent';
            item.style.border = 'none';
            item.style.padding = '0';
        } else {
            // Select
            this.selectedFilters[mode].add(filterValue);
            item.classList.add('selected');
            item.style.background = 'rgba(233, 69, 96, 0.2)';
            item.style.border = '1px solid var(--accent-color)';
            item.style.borderRadius = '4px';
            item.style.padding = '2px 4px';
        }
        
        // Apply combined filter
        this.applyCombinedFilter(mode);
    }

    // Apply combined filter from all selected items
    applyCombinedFilter(mode) {
        if (this.selectedFilters[mode].size === 0) {
            this.clearHighlight();
            ui.showNotification('All filters cleared', 'info');
            return;
        }
        
        // Find nodes matching ANY of the selected criteria (OR logic)
        const matchingNodes = this.nodes.filter(node => {
            return Array.from(this.selectedFilters[mode]).some(legendText => {
                const filterValue = this.extractFilterValue(mode, legendText);
                return this.nodeMatchesFilter(node, mode, filterValue, legendText);
            });
        });
        
        console.log(`🔍 Combined filter: ${matchingNodes.length} nodes match ${this.selectedFilters[mode].size} criteria`);
        
        // Highlight matching nodes
        this.highlightFilteredNodes(matchingNodes);
        
        // Show notification
        const selectedItems = Array.from(this.selectedFilters[mode]).join(', ');
        ui.showNotification(`Filtered: ${matchingNodes.length} movies (${selectedItems})`, 'info');
    }

    // Preview combined filter including hovered item
    previewCombinedFilter(mode, hoveredText) {
        const previewFilters = new Set(this.selectedFilters[mode]);
        previewFilters.add(hoveredText);
        
        const matchingNodes = this.nodes.filter(node => {
            return Array.from(previewFilters).some(legendText => {
                const filterValue = this.extractFilterValue(mode, legendText);
                return this.nodeMatchesFilter(node, mode, filterValue, legendText);
            });
        });
        
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
        
        this.clearHighlight();
        ui.showNotification('All filters cleared', 'info');
    }

    // Extract filter value from legend text
    extractFilterValue(mode, legendText) {
        switch (mode) {
            case 'depth':
                if (legendText.includes('Depth 0')) return 0;
                if (legendText.includes('Depth 1')) return 1;
                if (legendText.includes('Depth 2')) return 2;
                if (legendText.includes('Depth 3')) return 3;
                break;
                
            case 'genre':
                return legendText; // Genre name directly
                
            case 'year':
                return legendText; // Decade directly (e.g., "1990s")
                
            case 'rating':
                if (legendText.includes('Poor')) return 'poor';
                if (legendText.includes('Average')) return 'average';
                if (legendText.includes('Excellent')) return 'excellent';
                break;
                
            case 'popularity':
                if (legendText.includes('Low')) return 'low';
                if (legendText.includes('Medium')) return 'medium';
                if (legendText.includes('High')) return 'high';
                if (legendText.includes('Very popular')) return 'very_popular';
                break;
                
            case 'runtime':
                if (legendText.includes('Short')) return 'short';
                if (legendText.includes('Medium')) return 'medium';
                if (legendText.includes('Long') && !legendText.includes('Very')) return 'long';
                if (legendText.includes('Very long')) return 'very_long';
                break;
        }
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
                    case 'poor': return rating <= 3;
                    case 'average': return rating > 3 && rating <= 6;
                    case 'excellent': return rating > 6;
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
