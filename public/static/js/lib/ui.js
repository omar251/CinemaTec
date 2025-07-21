export function showLoading(show) {
    const loading = document.getElementById('loadingIndicator');
    loading.style.display = show ? 'block' : 'none';
}

export function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

export function updateSidebar(nodes) {
    const movieList = document.getElementById('movieList');
    
    if (nodes.length === 0) {
        movieList.innerHTML = `
            <div style="text-align: center; color: var(--text-secondary); padding: 20px;">
                Search for a movie to start building your network!
            </div>
        `;
        return;
    }

    const sortedNodes = [...nodes].sort((a, b) => {
        if (a.depth !== b.depth) return a.depth - b.depth;
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
                <div class="expand-node" data-node-id="${node.id}" style="
                    margin-top: 8px;
                    padding: 6px 12px;
                    background: var(--glass-bg);
                    border: 1px solid var(--accent-color);
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 12px;
                    color: var(--accent-color);
                    text-align: center;
                    transition: all 0.2s;
                " title="Add related movies to network">
                    🔗 Add Related Movies
                </div>
            </div>
        `;
    }).join('');

    // Add hover event listeners for network highlighting
    setupSidebarHoverEffects();
}

export function updateStats(nodes, links) {
    const stats = document.getElementById('networkStats');
    stats.textContent = `${nodes.length} movies, ${links.length} connections`;
}

export function showTooltip(event, d) {
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
    const overview = details.overview ? details.overview.substring(0, 150) + (details.overview.length > 150 ? '...' : '') : '';
    
    tooltip.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 8px; color: #f6e05e; font-size: 14px;">
            ${d.title} (${d.year})
        </div>
        ${rating ? `<div style="margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">${rating} ${votes}</div>` : ''}
        ${runtime || certification ? `<div style="margin-bottom: 4px; font-size: 12px;">${runtime} ${certification}</div>` : ''}
        ${genres ? `<div style="margin-bottom: 6px; font-size: 12px;">${genres}</div>` : ''}
        ${watchers ? `<div style="margin-bottom: 6px; font-size: 12px;">${watchers}</div>` : ''}
        ${overview ? `<div style="margin-bottom: 8px; font-size: 11px; color: #d0d0d0; line-height: 1.3; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 6px;">${overview}</div>` : ''}
        <div style="margin-top: 8px; font-size: 11px; color: #b0b0b0; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 6px;">
            <div style="display: flex; justify-content: space-between;">
                <span>Depth: ${d.depth}</span>
                <span style="color: #f6e05e;">Click for details</span>
            </div>
            <div style="margin-top: 4px; font-size: 10px; color: #888;">
                Double-click or Ctrl+click to add related movies
            </div>
        </div>
    `;
}

export function hideTooltip() {
    document.getElementById('tooltip').style.display = 'none';
}

// Setup hover effects for sidebar movie items to highlight network nodes
function setupSidebarHoverEffects() {
    const movieList = document.getElementById('movieList');
    
    // Remove existing listeners to prevent duplicates
    movieList.removeEventListener('mouseenter', handleSidebarHover, true);
    movieList.removeEventListener('mouseleave', handleSidebarLeave, true);
    
    // Add new listeners
    movieList.addEventListener('mouseenter', handleSidebarHover, true);
    movieList.addEventListener('mouseleave', handleSidebarLeave, true);
}

function handleSidebarHover(e) {
    const movieItem = e.target.closest('.movie-item');
    if (movieItem && !e.target.closest('.expand-node, .load-details')) {
        const nodeId = parseInt(movieItem.dataset.nodeId);
        if (nodeId !== undefined && !isNaN(nodeId)) {
            console.log('🎯 Highlighting node:', nodeId); // Debug log
            // Dispatch custom event for network highlighting
            document.dispatchEvent(new CustomEvent('highlightNetworkNode', { 
                detail: { nodeId } 
            }));
        }
    }
}

function handleSidebarLeave(e) {
    const movieItem = e.target.closest('.movie-item');
    if (movieItem && !e.relatedTarget?.closest('.movie-item')) {
        // Dispatch custom event to clear network highlighting
        document.dispatchEvent(new CustomEvent('clearNetworkHighlight'));
    }
}

export function showMovieDetailsModal(node) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('movieDetailsModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'movieDetailsModal';
        modal.className = 'modal';
        modal.style.display = 'none';
        document.body.appendChild(modal);
    }

    const details = node.fullDetails || node.basicDetails || {};
    const rating = details.rating ? details.rating.toFixed(1) : 'N/A';
    const votes = details.votes ? details.votes.toLocaleString() : 'N/A';
    const runtime = details.runtime ? `${details.runtime} min` : 'N/A';
    const certification = details.certification || 'Not Rated';
    const genres = details.genres ? details.genres.join(', ') : 'Unknown';
    const overview = details.overview || 'No overview available.';
    const watchers = details.stats?.watchers ? details.stats.watchers.toLocaleString() : 'N/A';
    const plays = details.stats?.plays ? details.stats.plays.toLocaleString() : 'N/A';
    const collected = details.stats?.collected ? details.stats.collected.toLocaleString() : 'N/A';
    
    // Get poster URL from multiple possible sources
    const posterUrl = details.poster_url ||  // From enhancement service
                     details.images?.poster?.medium || 
                     details.images?.poster?.full || 
                     (details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : null) ||
                     (details.tmdb_data?.poster_path ? `https://image.tmdb.org/t/p/w500${details.tmdb_data.poster_path}` : null);

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header">
                <h3>🎬 ${node.title} (${node.year})</h3>
                <button class="close-btn" id="closeMovieDetailsBtn">&times;</button>
            </div>
            <div class="modal-body">
                <div style="display: grid; grid-template-columns: ${posterUrl ? '200px 1fr' : '1fr'}; gap: 20px; margin-bottom: 20px;">
                    ${posterUrl ? `
                        <div class="movie-poster">
                            <img src="${posterUrl}" alt="${node.title} poster" style="
                                width: 100%;
                                height: auto;
                                border-radius: 10px;
                                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                            " onerror="this.style.display='none'; console.log('Poster failed to load:', '${posterUrl}');">
                        </div>
                    ` : `
                        <div class="movie-poster-placeholder" style="
                            width: 200px;
                            height: 300px;
                            background: var(--glass-bg);
                            border-radius: 10px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            border: 2px dashed var(--glass-border);
                            color: var(--text-secondary);
                            font-size: 14px;
                            text-align: center;
                        ">
                            🎬<br>No Poster<br>Available
                        </div>
                    `}
                    <div class="movie-info">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                            <div class="info-item">
                                <strong style="color: var(--gemini-accent);">Rating:</strong>
                                <div style="font-size: 18px; color: var(--text-color);">⭐ ${rating}/10</div>
                                <div style="font-size: 12px; color: var(--text-secondary);">${votes} votes</div>
                            </div>
                            <div class="info-item">
                                <strong style="color: var(--gemini-accent);">Runtime:</strong>
                                <div style="color: var(--text-color);">⏱️ ${runtime}</div>
                            </div>
                            <div class="info-item">
                                <strong style="color: var(--gemini-accent);">Certification:</strong>
                                <div style="color: var(--text-color);">🎬 ${certification}</div>
                            </div>
                            <div class="info-item">
                                <strong style="color: var(--gemini-accent);">Network Depth:</strong>
                                <div style="color: var(--text-color);">📊 Level ${node.depth}</div>
                            </div>
                        </div>
                        
                        <div style="margin-bottom: 15px;">
                            <strong style="color: var(--gemini-accent);">Genres:</strong>
                            <div style="margin-top: 5px;">
                                ${details.genres ? details.genres.map(genre => 
                                    `<span style="
                                        background: var(--glass-bg);
                                        padding: 4px 12px;
                                        border-radius: 15px;
                                        font-size: 12px;
                                        margin-right: 8px;
                                        margin-bottom: 5px;
                                        display: inline-block;
                                        border: 1px solid var(--glass-border);
                                    ">${genre}</span>`
                                ).join('') : '<span style="color: var(--text-secondary);">Unknown</span>'}
                            </div>
                        </div>

                        ${details.stats ? `
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                                <div class="stat-item" style="text-align: center; padding: 10px; background: var(--glass-bg); border-radius: 8px;">
                                    <div style="font-size: 18px; font-weight: bold; color: var(--accent-color);">${watchers}</div>
                                    <div style="font-size: 11px; color: var(--text-secondary);">👥 Watchers</div>
                                </div>
                                <div class="stat-item" style="text-align: center; padding: 10px; background: var(--glass-bg); border-radius: 8px;">
                                    <div style="font-size: 18px; font-weight: bold; color: var(--gemini-accent);">${plays}</div>
                                    <div style="font-size: 11px; color: var(--text-secondary);">▶️ Plays</div>
                                </div>
                                <div class="stat-item" style="text-align: center; padding: 10px; background: var(--glass-bg); border-radius: 8px;">
                                    <div style="font-size: 18px; font-weight: bold; color: var(--success-color);">${collected}</div>
                                    <div style="font-size: 11px; color: var(--text-secondary);">💾 Collected</div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div style="margin-bottom: 20px;">
                    <strong style="color: var(--gemini-accent);">Overview:</strong>
                    <div style="
                        margin-top: 8px;
                        line-height: 1.6;
                        color: var(--text-color);
                        background: var(--glass-bg);
                        padding: 15px;
                        border-radius: 10px;
                        border-left: 4px solid var(--accent-color);
                    ">${overview}</div>
                </div>

                ${details.trailer ? `
                    <div style="margin-bottom: 20px;">
                        <strong style="color: var(--gemini-accent);">Trailer:</strong>
                        <div style="margin-top: 8px;">
                            <a href="${details.trailer}" target="_blank" class="trailer-link" style="
                                color: var(--accent-color);
                                text-decoration: none;
                                padding: 8px 16px;
                                background: var(--glass-bg);
                                border-radius: 8px;
                                border: 1px solid var(--accent-color);
                                display: inline-block;
                                transition: all 0.2s;
                            ">
                                🎥 Watch Trailer
                            </a>
                        </div>
                    </div>
                ` : ''}
            </div>
            <div class="modal-footer">
                <button class="control-btn primary" id="expandNodeBtn" data-node-id="${node.id}">
                    🔗 Add Related Movies
                </button>
                <button class="control-btn" id="closeMovieDetailsFooterBtn">Close</button>
            </div>
        </div>
    `;

    modal.style.display = 'flex';

    // Add event listeners
    const closeBtn = document.getElementById('closeMovieDetailsBtn');
    const closeFooterBtn = document.getElementById('closeMovieDetailsFooterBtn');
    const expandBtn = document.getElementById('expandNodeBtn');

    const closeModal = () => {
        modal.style.display = 'none';
    };

    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }

    if (closeFooterBtn) {
        closeFooterBtn.addEventListener('click', closeModal);
    }

    if (expandBtn) {
        expandBtn.addEventListener('click', () => {
            closeModal();
            // Trigger expansion - we'll need to access the network instance
            const event = new CustomEvent('expandNode', { detail: { nodeId: node.id } });
            document.dispatchEvent(event);
        });
    }

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
}
