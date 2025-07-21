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

        this.colorScale = d3.scaleOrdinal()
            .domain([0, 1, 2, 3])
            .range(['#e94560', '#f6e05e', '#10b981', '#3b82f6']);
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

            if (e.target.closest('.expand-node')) {
                e.stopPropagation();
                const expandBtn = e.target.closest('.expand-node');
                const nodeId = parseInt(expandBtn.dataset.nodeId);
                if (nodeId !== undefined) {
                    const node = this.nodes.find(n => n.id === nodeId);
                    if (node) {
                        this.expandNode(node);
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
            .attr('fill', d => this.colorScale(Math.min(d.depth, 3)))
            .call(this.getDragBehavior())
            .on('click', (event, d) => this.handleNodeClick(event, d))
            .on('mouseover', (event, d) => ui.showTooltip(event, d))
            .on('mouseout', () => ui.hideTooltip());

        nodeEnter.merge(nodeSelection)
            .attr('class', d => `node ${d.expanding ? 'expanding' : ''}`)
            .attr('fill', d => this.colorScale(Math.min(d.depth, 3)));

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
        const transform = d3.zoomIdentity.translate(this.width / 2, this.height / 2).scale(1);
        this.svg.transition().duration(750).call(this.zoom.transform, transform);
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
}
