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
            </div>
        `;
    }).join('');
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

export function hideTooltip() {
    document.getElementById('tooltip').style.display = 'none';
}
