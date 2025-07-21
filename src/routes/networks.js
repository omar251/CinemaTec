/**
 * Network storage routes
 */
const express = require('express');
const router = express.Router();
const NetworkStorage = require('../lib/network_storage');
const logger = require('../utils/logger');
const config = require('../config');

// Initialize network storage
const networkStorage = new NetworkStorage(config.storage.type, {
  dataDir: config.storage.dataDir,
});

// Save network
router.post('/save', async (req, res) => {
  try {
    const { name, description, nodes, links, settings, seedMovie } = req.body;

    if (!nodes || !Array.isArray(nodes)) {
      return res.status(400).json({ error: 'Nodes array is required' });
    }

    if (nodes.length === 0) {
      return res.status(400).json({ error: 'Network must contain at least one node' });
    }

    const networkData = {
      name: name || 'Untitled Network',
      description: description || '',
      nodes,
      links: links || [],
      settings: settings || {},
      seedMovie: seedMovie || null,
    };

    logger.info(`Saving network: ${networkData.name}`, {
      nodeCount: nodes.length,
      linkCount: links?.length || 0
    });

    const result = await networkStorage.saveNetworkToFile(networkData);

    if (result.success) {
      logger.info(`Network saved successfully: ${result.id}`);
      res.json({
        success: true,
        networkId: result.id,
        message: 'Network saved successfully',
        metadata: result.metadata,
      });
    } else {
      logger.error(`Failed to save network: ${result.error}`);
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    logger.error(`Error saving network: ${error.message}`);
    res.status(500).json({ error: 'Failed to save network' });
  }
});

// Load network
router.get('/:networkId', async (req, res) => {
  try {
    const { networkId } = req.params;
    
    logger.debug(`Loading network: ${networkId}`);
    const result = await networkStorage.loadNetworkFromFile(networkId);

    if (result.success) {
      logger.debug(`Network loaded successfully: ${networkId}`);
      res.json(result.data);
    } else {
      logger.warn(`Network not found: ${networkId}`);
      res.status(404).json({ error: result.error });
    }
  } catch (error) {
    logger.error(`Error loading network: ${error.message}`, { networkId: req.params.networkId });
    res.status(500).json({ error: 'Failed to load network' });
  }
});

// List all networks
router.get('/', async (req, res) => {
  try {
    logger.debug('Listing all networks');
    const result = await networkStorage.listNetworks();

    if (result.success) {
      logger.debug(`Found ${result.networks.length} networks`);
      res.json(result.networks);
    } else {
      logger.error(`Failed to list networks: ${result.error}`);
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    logger.error(`Error listing networks: ${error.message}`);
    res.status(500).json({ error: 'Failed to list networks' });
  }
});

// Update network
router.put('/:networkId', async (req, res) => {
  try {
    const { networkId } = req.params;
    const updateData = req.body;

    if (!updateData || Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'Update data is required' });
    }

    logger.info(`Updating network: ${networkId}`, {
      updateFields: Object.keys(updateData)
    });

    const result = await networkStorage.updateNetwork(networkId, updateData);

    if (result.success) {
      logger.info(`Network updated successfully: ${networkId}`);
      res.json({
        success: true,
        message: 'Network updated successfully',
        metadata: result.metadata,
      });
    } else {
      logger.error(`Failed to update network: ${result.error}`, { networkId });
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    logger.error(`Error updating network: ${error.message}`, { networkId: req.params.networkId });
    res.status(500).json({ error: 'Failed to update network' });
  }
});

// Delete network
router.delete('/:networkId', async (req, res) => {
  try {
    const { networkId } = req.params;
    
    logger.info(`Deleting network: ${networkId}`);
    const result = await networkStorage.deleteNetwork(networkId);

    if (result.success) {
      logger.info(`Network deleted successfully: ${networkId}`);
      res.json({ success: true, message: 'Network deleted successfully' });
    } else {
      logger.error(`Failed to delete network: ${result.error}`, { networkId });
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    logger.error(`Error deleting network: ${error.message}`, { networkId: req.params.networkId });
    res.status(500).json({ error: 'Failed to delete network' });
  }
});

// Export network in different formats
router.get('/:networkId/export/:format', async (req, res) => {
  try {
    const { networkId, format } = req.params;
    
    if (!['json', 'csv', 'graphml'].includes(format)) {
      return res.status(400).json({ error: 'Unsupported export format. Use: json, csv, graphml' });
    }

    logger.info(`Exporting network: ${networkId} as ${format}`);
    const result = await networkStorage.exportNetwork(networkId, format);

    if (result.success) {
      const filename = `network_${networkId}.${format}`;
      
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', result.mimeType || 'application/octet-stream');
      
      logger.info(`Network exported successfully: ${networkId} as ${format}`);
      res.send(result.data);
    } else {
      logger.error(`Failed to export network: ${result.error}`, { networkId, format });
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    logger.error(`Error exporting network: ${error.message}`, { 
      networkId: req.params.networkId, 
      format: req.params.format 
    });
    res.status(500).json({ error: 'Failed to export network' });
  }
});

// Get network statistics
router.get('/:networkId/stats', async (req, res) => {
  try {
    const { networkId } = req.params;
    
    const result = await networkStorage.loadNetworkFromFile(networkId);
    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }

    const network = result.data;
    const stats = {
      networkId,
      name: network.name,
      nodeCount: network.nodes?.length || 0,
      linkCount: network.links?.length || 0,
      seedMovie: network.seedMovie,
      createdAt: result.metadata?.createdAt,
      updatedAt: result.metadata?.updatedAt,
      fileSize: result.metadata?.size
    };

    res.json(stats);
  } catch (error) {
    logger.error(`Error getting network stats: ${error.message}`, { networkId: req.params.networkId });
    res.status(500).json({ error: 'Failed to get network statistics' });
  }
});

module.exports = router;