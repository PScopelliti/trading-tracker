/**
 * Main Application Controller
 * Handles file uploads, data processing, and UI updates
 */

// Global instances
let parser = null;
let statsCalculator = null;
let chartManager = null;
let currentTrades = [];
let currentCurrency = 'USD'; // Will be detected from file

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    parser = new TradeParser();
    chartManager = new ChartManager();
    
    setupFileUpload();
    setupDragAndDrop();
}

/**
 * Setup file input handler
 */
function setupFileUpload() {
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelect);
    }
}

/**
 * Setup drag and drop functionality
 */
function setupDragAndDrop() {
    const uploadBox = document.getElementById('uploadBox');
    if (!uploadBox) return;

    uploadBox.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadBox.classList.add('drag-over');
    });

    uploadBox.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadBox.classList.remove('drag-over');
    });

    uploadBox.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadBox.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            processFile(files[0]);
        }
    });
}

/**
 * Handle file selection from input
 */
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        processFile(file);
    }
}

/**
 * Process uploaded file
 */
async function processFile(file) {
    try {
        showToast('Processing file...', 'info');
        
        const trades = await parser.parseFile(file);
        currentTrades = trades;
        
        // Extract currency from parsed data
        if (trades.currency) {
            currentCurrency = trades.currency;
        } else if (parser.currency) {
            currentCurrency = parser.currency;
        }
        
        showToast(`Successfully loaded ${trades.length} trades!`, 'success');
        displayDashboard(trades);
        
    } catch (error) {
        console.error('Error processing file:', error);
        showToast(error.message || 'Failed to process file', 'error');
    }
}

/**
 * Load sample data for demo purposes
 */
function loadSampleData() {
    const sampleTrades = generateSampleTrades();
    currentTrades = sampleTrades;
    
    showToast(`Loaded ${sampleTrades.length} sample trades`, 'success');
    displayDashboard(sampleTrades);
}

/**
 * Generate realistic sample trading data
 */
function generateSampleTrades() {
    const symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'XAUUSD'];
    const trades = [];
    
    let currentDate = new Date();
    currentDate.setMonth(currentDate.getMonth() - 3);
    
    for (let i = 0; i < 150; i++) {
        // Random trading day (skip weekends)
        currentDate.setDate(currentDate.getDate() + Math.floor(Math.random() * 3) + 1);
        while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        const symbol = symbols[Math.floor(Math.random() * symbols.length)];
        const type = Math.random() > 0.5 ? 'buy' : 'sell';
        const volume = [0.01, 0.02, 0.05, 0.1, 0.2][Math.floor(Math.random() * 5)];
        
        // Create realistic win/loss distribution (55% win rate)
        const isWin = Math.random() < 0.55;
        
        // Realistic profit distribution
        let profit;
        if (isWin) {
            // Wins: mostly small to medium, occasional big wins
            const winType = Math.random();
            if (winType < 0.6) {
                profit = (Math.random() * 50 + 10) * volume * 100; // Small win
            } else if (winType < 0.9) {
                profit = (Math.random() * 100 + 50) * volume * 100; // Medium win
            } else {
                profit = (Math.random() * 200 + 150) * volume * 100; // Big win
            }
        } else {
            // Losses: mostly controlled, occasional bigger losses
            const lossType = Math.random();
            if (lossType < 0.7) {
                profit = -(Math.random() * 40 + 10) * volume * 100; // Small loss
            } else if (lossType < 0.95) {
                profit = -(Math.random() * 80 + 40) * volume * 100; // Medium loss
            } else {
                profit = -(Math.random() * 150 + 80) * volume * 100; // Big loss
            }
        }
        
        // Round profit
        profit = Math.round(profit * 100) / 100;
        
        // Commission based on volume
        const commission = -Math.round(volume * 7 * 100) / 100;
        
        // Small random swap
        const swap = Math.round((Math.random() - 0.5) * 2 * 100) / 100;
        
        // Open and close times
        const openTime = new Date(currentDate);
        openTime.setHours(Math.floor(Math.random() * 12) + 7); // 7 AM - 7 PM
        openTime.setMinutes(Math.floor(Math.random() * 60));
        
        const holdingMinutes = Math.floor(Math.random() * 480) + 5; // 5 min to 8 hours
        const closeTime = new Date(openTime.getTime() + holdingMinutes * 60000);
        
        // Generate prices
        let basePrice;
        switch (symbol) {
            case 'EURUSD': basePrice = 1.08 + Math.random() * 0.02; break;
            case 'GBPUSD': basePrice = 1.26 + Math.random() * 0.02; break;
            case 'USDJPY': basePrice = 148 + Math.random() * 2; break;
            case 'AUDUSD': basePrice = 0.65 + Math.random() * 0.01; break;
            case 'USDCAD': basePrice = 1.35 + Math.random() * 0.01; break;
            case 'XAUUSD': basePrice = 2000 + Math.random() * 50; break;
            default: basePrice = 1.0;
        }
        
        const pips = profit / (volume * 10);
        const pipValue = symbol === 'USDJPY' ? 0.01 : (symbol === 'XAUUSD' ? 0.1 : 0.0001);
        
        const openPrice = Math.round(basePrice * 100000) / 100000;
        let closePrice;
        if (type === 'buy') {
            closePrice = Math.round((openPrice + (pips * pipValue / 10)) * 100000) / 100000;
        } else {
            closePrice = Math.round((openPrice - (pips * pipValue / 10)) * 100000) / 100000;
        }
        
        trades.push({
            ticket: (1000000 + i).toString(),
            symbol: symbol,
            type: type,
            volume: volume,
            openPrice: openPrice,
            closePrice: closePrice,
            openTime: openTime,
            closeTime: closeTime,
            profit: profit,
            commission: commission,
            swap: swap,
            netProfit: profit + commission + swap
        });
    }
    
    // Sort by close time
    trades.sort((a, b) => new Date(a.closeTime) - new Date(b.closeTime));
    
    return trades;
}

/**
 * Display dashboard with trade data
 */
function displayDashboard(trades) {
    // Calculate statistics
    statsCalculator = new StatsCalculator(trades);
    const stats = statsCalculator.calculateAll();
    
    // Update UI
    updateStatCards(stats);
    updateDetailedStats(stats);
    updateTradeTable(trades);
    
    // Create charts
    chartManager.destroyCharts();
    chartManager.initializeCharts(stats);
    
    // Show dashboard, hide upload
    document.getElementById('uploadSection').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('dashboard').classList.add('fade-in');
}

/**
 * Update stat cards in the dashboard
 */
function updateStatCards(stats) {
    // Total P&L
    const pnlElement = document.getElementById('totalPnL');
    const pnlValue = stats.netPnL;
    pnlElement.textContent = formatCurrency(pnlValue);
    pnlElement.className = 'stat-value ' + (pnlValue >= 0 ? 'positive' : 'negative');
    
    // Win Rate
    document.getElementById('winRate').textContent = stats.winRate.toFixed(1) + '%';
    
    // Total Trades
    document.getElementById('totalTrades').textContent = stats.totalTrades;
    
    // Profit Factor
    const pfValue = stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2);
    document.getElementById('profitFactor').textContent = pfValue;
    
    // Max Drawdown
    document.getElementById('maxDrawdown').textContent = formatCurrency(-stats.maxDrawdown);
    
    // Average Trade
    document.getElementById('avgTrade').textContent = formatCurrency(stats.avgTrade);
}

/**
 * Update detailed statistics table
 */
function updateDetailedStats(stats) {
    document.getElementById('bestTrade').textContent = formatCurrency(stats.bestTrade);
    document.getElementById('worstTrade').textContent = formatCurrency(stats.worstTrade);
    document.getElementById('avgWin').textContent = formatCurrency(stats.avgWin);
    document.getElementById('avgLoss').textContent = formatCurrency(stats.avgLoss);
    document.getElementById('winStreak').textContent = stats.maxWinStreak;
    document.getElementById('loseStreak').textContent = stats.maxLoseStreak;
    document.getElementById('avgHoldTime').textContent = stats.avgHoldingTime.formatted;
    
    const rrValue = stats.riskRewardRatio === Infinity ? '∞' : stats.riskRewardRatio.toFixed(2);
    document.getElementById('riskReward').textContent = rrValue;
}

/**
 * Update trade history table
 */
function updateTradeTable(trades) {
    const tbody = document.getElementById('tradeTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Show most recent trades first
    const sortedTrades = [...trades].sort((a, b) => 
        new Date(b.closeTime) - new Date(a.closeTime)
    );
    
    for (const trade of sortedTrades) {
        const row = document.createElement('tr');
        
        const profit = trade.netProfit !== undefined ? trade.netProfit : trade.profit;
        const profitClass = profit >= 0 ? 'profit-positive' : 'profit-negative';
        const typeClass = trade.type === 'buy' ? 'type-buy' : 'type-sell';
        
        row.innerHTML = `
            <td>${formatDate(trade.closeTime)}</td>
            <td>${trade.symbol}</td>
            <td class="${typeClass}">${trade.type.toUpperCase()}</td>
            <td>${trade.volume.toFixed(2)}</td>
            <td>${formatPrice(trade.openPrice, trade.symbol)}</td>
            <td>${formatPrice(trade.closePrice, trade.symbol)}</td>
            <td class="${profitClass}">${formatCurrency(profit)}</td>
        `;
        
        tbody.appendChild(row);
    }
}

/**
 * Reset dashboard and show upload section
 */
function resetDashboard() {
    chartManager.destroyCharts();
    currentTrades = [];
    
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('uploadSection').style.display = 'flex';
    
    // Reset file input
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.value = '';
    }
}

/**
 * Format currency value with detected currency symbol
 */
function formatCurrency(value) {
    const sign = value >= 0 ? '' : '-';
    const symbol = getCurrencySymbol(currentCurrency);
    return sign + symbol + Math.abs(value).toFixed(2);
}

/**
 * Get currency symbol from currency code
 */
function getCurrencySymbol(currencyCode) {
    const symbols = {
        'USD': '$',
        'EUR': '€',
        'GBP': '£',
        'JPY': '¥',
        'AUD': 'A$',
        'CAD': 'C$',
        'CHF': 'CHF ',
        'NZD': 'NZ$'
    };
    return symbols[currencyCode] || currencyCode + ' ';
}

/**
 * Format date for display
 */
function formatDate(date) {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Format price based on symbol
 */
function formatPrice(price, symbol) {
    if (!price) return '-';
    
    if (symbol === 'USDJPY') {
        return price.toFixed(3);
    } else if (symbol === 'XAUUSD') {
        return price.toFixed(2);
    } else {
        return price.toFixed(5);
    }
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(t => t.remove());
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Make functions globally accessible
window.loadSampleData = loadSampleData;
window.resetDashboard = resetDashboard;