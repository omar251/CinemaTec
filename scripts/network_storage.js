#!/usr/bin/env node
/**
 * Network Storage Manager
 * Handles saving and loading movie networks with both file and database options
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class NetworkStorage {
    constructor(storageType = 'file', options = {}) {
        this.storageType = storageType;
        this.options = {
            dataDir: options.dataDir || 'saved_networks',
            dbPath: options.dbPath || 'networks.db',
            ...options
        };
        
        this.initializeStorage();
    }

    async initializeStorage() {
        if (this.storageType === 'file') {
            await this.initializeFileStorage();
        } else if (this.storageType === 'database') {
            await this.initializeDatabaseStorage();
        }
    }

    async initializeFileStorage() {
        try {
            await fs.mkdir(this.options.dataDir, { recursive: true });
            console.log(`📁 File storage initialized: ${this.options.dataDir}`);
        } catch (error) {
            console.error('Failed to initialize file storage:', error.message);
        }
    }

    async initializeDatabaseStorage() {
        // Database initialization would go here
        // For now, we'll focus on file storage
        console.log('🗃️ Database storage not yet implemented');
    }

    // Generate unique network ID
    generateNetworkId(name = null) {
        const timestamp = Date.now();
        const random = crypto.randomBytes(4).toString('hex');
        const baseName = name ? name.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'network';
        return `${baseName}_${timestamp}_${random}`;
    }

    // Save network to file
    async saveNetworkToFile(networkData, networkId = null) {
        try {
            const id = networkId || this.generateNetworkId(networkData.name);
            const filename = `${id}.json`;
            const filepath = path.join(this.options.dataDir, filename);

            const saveData = {
                id: id,
                name: networkData.name || 'Untitled Network',
                description: networkData.description || '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                metadata: {
                    totalMovies: networkData.nodes?.length || 0,
                    totalConnections: networkData.links?.length || 0,
                    seedMovie: networkData.seedMovie || null,
                    maxDepth: Math.max(...(networkData.nodes?.map(n => n.depth) || [0])),
                    genres: this.extractGenres(networkData.nodes),
                    averageRating: this.calculateAverageRating(networkData.nodes)
                },
                nodes: networkData.nodes || [],
                links: networkData.links || [],
                settings: networkData.settings || {}
            };

            await fs.writeFile(filepath, JSON.stringify(saveData, null, 2));
            console.log(`💾 Network saved: ${filepath}`);
            
            return {
                success: true,
                id: id,
                filepath: filepath,
                metadata: saveData.metadata
            };

        } catch (error) {
            console.error('Failed to save network:', error.message);
            return { success: false, error: error.message };
        }
    }

    // Load network from file
    async loadNetworkFromFile(networkId) {
        try {
            const filename = `${networkId}.json`;
            const filepath = path.join(this.options.dataDir, filename);
            
            const data = await fs.readFile(filepath, 'utf8');
            const networkData = JSON.parse(data);
            
            console.log(`📂 Network loaded: ${filepath}`);
            return { success: true, data: networkData };

        } catch (error) {
            console.error(`Failed to load network ${networkId}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    // List all saved networks
    async listNetworks() {
        try {
            const files = await fs.readdir(this.options.dataDir);
            const networkFiles = files.filter(file => file.endsWith('.json'));
            
            const networks = [];
            for (const file of networkFiles) {
                try {
                    const filepath = path.join(this.options.dataDir, file);
                    const data = await fs.readFile(filepath, 'utf8');
                    const networkData = JSON.parse(data);
                    
                    networks.push({
                        id: networkData.id,
                        name: networkData.name,
                        description: networkData.description,
                        createdAt: networkData.createdAt,
                        updatedAt: networkData.updatedAt,
                        metadata: networkData.metadata,
                        filename: file
                    });
                } catch (error) {
                    console.warn(`Skipping invalid network file: ${file}`);
                }
            }

            // Sort by creation date (newest first)
            networks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            return { success: true, networks: networks };

        } catch (error) {
            console.error('Failed to list networks:', error.message);
            return { success: false, error: error.message };
        }
    }

    // Delete network
    async deleteNetwork(networkId) {
        try {
            const filename = `${networkId}.json`;
            const filepath = path.join(this.options.dataDir, filename);
            
            await fs.unlink(filepath);
            console.log(`🗑️ Network deleted: ${filepath}`);
            
            return { success: true };

        } catch (error) {
            console.error(`Failed to delete network ${networkId}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    // Update existing network
    async updateNetwork(networkId, networkData) {
        try {
            // Load existing data
            const existing = await this.loadNetworkFromFile(networkId);
            if (!existing.success) {
                return existing;
            }

            // Merge with new data
            const updatedData = {
                ...existing.data,
                ...networkData,
                id: networkId, // Preserve original ID
                createdAt: existing.data.createdAt, // Preserve creation date
                updatedAt: new Date().toISOString()
            };

            // Save updated data
            return await this.saveNetworkToFile(updatedData, networkId);

        } catch (error) {
            console.error(`Failed to update network ${networkId}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    // Export network to different formats
    async exportNetwork(networkId, format = 'json') {
        const result = await this.loadNetworkFromFile(networkId);
        if (!result.success) return result;

        const networkData = result.data;

        switch (format.toLowerCase()) {
            case 'json':
                return {
                    success: true,
                    data: JSON.stringify(networkData, null, 2),
                    filename: `${networkId}.json`,
                    contentType: 'application/json'
                };

            case 'csv':
                return this.exportToCSV(networkData);

            case 'graphml':
                return this.exportToGraphML(networkData);

            default:
                return { success: false, error: `Unsupported format: ${format}` };
        }
    }

    // Helper methods
    extractGenres(nodes) {
        if (!nodes) return [];
        
        const genreSet = new Set();
        nodes.forEach(node => {
            const details = node.fullDetails || node.basicDetails || {};
            if (details.genres) {
                details.genres.forEach(genre => genreSet.add(genre));
            }
        });
        
        return Array.from(genreSet);
    }

    calculateAverageRating(nodes) {
        if (!nodes) return 0;
        
        const ratingsWithValues = nodes
            .map(node => {
                const details = node.fullDetails || node.basicDetails || {};
                return details.rating || 0;
            })
            .filter(rating => rating > 0);

        if (ratingsWithValues.length === 0) return 0;
        
        const sum = ratingsWithValues.reduce((acc, rating) => acc + rating, 0);
        return Math.round((sum / ratingsWithValues.length) * 10) / 10;
    }

    exportToCSV(networkData) {
        try {
            const nodes = networkData.nodes || [];
            const csvHeaders = 'ID,Title,Year,Rating,Genres,Depth,TraktID\n';
            
            const csvRows = nodes.map(node => {
                const details = node.fullDetails || node.basicDetails || {};
                const genres = details.genres ? details.genres.join(';') : '';
                const rating = details.rating || '';
                
                return `${node.id},"${node.title}",${node.year},${rating},"${genres}",${node.depth},${node.traktId}`;
            }).join('\n');

            return {
                success: true,
                data: csvHeaders + csvRows,
                filename: `${networkData.id}.csv`,
                contentType: 'text/csv'
            };

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    exportToGraphML(networkData) {
        try {
            const nodes = networkData.nodes || [];
            const links = networkData.links || [];

            let graphml = `<?xml version="1.0" encoding="UTF-8"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns">
  <key id="title" for="node" attr.name="title" attr.type="string"/>
  <key id="year" for="node" attr.name="year" attr.type="int"/>
  <key id="rating" for="node" attr.name="rating" attr.type="double"/>
  <key id="depth" for="node" attr.name="depth" attr.type="int"/>
  <graph id="MovieNetwork" edgedefault="undirected">
`;

            // Add nodes
            nodes.forEach(node => {
                const details = node.fullDetails || node.basicDetails || {};
                const rating = details.rating || 0;
                
                graphml += `    <node id="${node.id}">
      <data key="title">${node.title}</data>
      <data key="year">${node.year}</data>
      <data key="rating">${rating}</data>
      <data key="depth">${node.depth}</data>
    </node>
`;
            });

            // Add edges
            links.forEach((link, index) => {
                const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                
                graphml += `    <edge id="e${index}" source="${sourceId}" target="${targetId}"/>
`;
            });

            graphml += `  </graph>
</graphml>`;

            return {
                success: true,
                data: graphml,
                filename: `${networkData.id}.graphml`,
                contentType: 'application/xml'
            };

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Get storage statistics
    async getStorageStats() {
        try {
            const listResult = await this.listNetworks();
            if (!listResult.success) return listResult;

            const networks = listResult.networks;
            const totalNetworks = networks.length;
            const totalMovies = networks.reduce((sum, net) => sum + (net.metadata.totalMovies || 0), 0);
            const totalConnections = networks.reduce((sum, net) => sum + (net.metadata.totalConnections || 0), 0);
            
            // Calculate storage size
            const files = await fs.readdir(this.options.dataDir);
            let totalSize = 0;
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const filepath = path.join(this.options.dataDir, file);
                    const stats = await fs.stat(filepath);
                    totalSize += stats.size;
                }
            }

            return {
                success: true,
                stats: {
                    totalNetworks,
                    totalMovies,
                    totalConnections,
                    storageSize: totalSize,
                    storageSizeFormatted: this.formatBytes(totalSize),
                    averageNetworkSize: totalNetworks > 0 ? Math.round(totalMovies / totalNetworks) : 0
                }
            };

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

module.exports = NetworkStorage;