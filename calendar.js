/**
 * Trading Calendar Manager
 * Displays daily profit/loss in a calendar view
 */

class CalendarManager {
    constructor() {
        this.currentDate = new Date();
        this.currentMonth = this.currentDate.getMonth();
        this.currentYear = this.currentDate.getFullYear();
        this.dailyPnL = {};
        this.trades = [];
    }

    /**
     * Initialize the calendar with trade data
     */
    initialize(trades) {
        this.trades = trades || [];
        this.calculateDailyPnL();
        this.setupEventListeners();
        this.render();
    }

    /**
     * Calculate daily profit/loss and pips from trades
     */
    calculateDailyPnL() {
        this.dailyPnL = {};
        
        for (const trade of this.trades) {
            if (!trade.closeTime) continue;
            
            const closeDate = new Date(trade.closeTime);
            const dateKey = this.formatDateKey(closeDate);
            
            if (!this.dailyPnL[dateKey]) {
                this.dailyPnL[dateKey] = {
                    profit: 0,
                    pips: 0,
                    trades: 0,
                    wins: 0,
                    losses: 0
                };
            }
            
            const profit = trade.netProfit !== undefined ? trade.netProfit : trade.profit;
            const pips = this.calculateTradePips(trade);
            
            this.dailyPnL[dateKey].profit += profit;
            this.dailyPnL[dateKey].pips += pips;
            this.dailyPnL[dateKey].trades++;
            
            if (profit > 0) {
                this.dailyPnL[dateKey].wins++;
            } else if (profit < 0) {
                this.dailyPnL[dateKey].losses++;
            }
        }
    }

    /**
     * Get pip size for a symbol
     */
    getPipSize(symbol) {
        if (!symbol) return 0.0001;
        
        const upperSymbol = symbol.toUpperCase();
        
        // JPY pairs have pip size of 0.01
        if (upperSymbol.includes('JPY')) {
            return 0.01;
        }
        
        // Gold (XAU) typically uses 0.1 as pip
        if (upperSymbol.includes('XAU')) {
            return 0.1;
        }
        
        // Indices and other instruments
        if (upperSymbol.includes('US30') || upperSymbol.includes('US500') ||
            upperSymbol.includes('NAS') || upperSymbol.includes('DAX') ||
            upperSymbol.includes('SPX')) {
            return 1;
        }
        
        // Default forex pip size
        return 0.0001;
    }

    /**
     * Calculate pips for a single trade
     */
    calculateTradePips(trade) {
        if (!trade.openPrice || !trade.closePrice || !trade.symbol) {
            return 0;
        }
        
        const pipSize = this.getPipSize(trade.symbol);
        const direction = trade.type === 'buy' ? 1 : -1;
        const priceDiff = trade.closePrice - trade.openPrice;
        const pips = (priceDiff / pipSize) * direction;
        
        return Math.round(pips * 10) / 10; // Round to 1 decimal
    }

    /**
     * Format date as YYYY-MM-DD key
     */
    formatDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Setup calendar navigation event listeners
     */
    setupEventListeners() {
        const prevBtn = document.getElementById('prevMonth');
        const nextBtn = document.getElementById('nextMonth');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.navigateMonth(-1));
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.navigateMonth(1));
        }
    }

    /**
     * Navigate to previous/next month
     */
    navigateMonth(direction) {
        this.currentMonth += direction;
        
        if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear--;
        } else if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
        }
        
        this.render();
    }

    /**
     * Render the calendar
     */
    render() {
        this.updateMonthYearDisplay();
        this.renderCalendarDays();
    }

    /**
     * Update the month/year header display
     */
    updateMonthYearDisplay() {
        const monthYearElement = document.getElementById('calendarMonthYear');
        if (!monthYearElement) return;
        
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        
        monthYearElement.textContent = `${monthNames[this.currentMonth]} ${this.currentYear}`;
    }

    /**
     * Render calendar days grid
     */
    renderCalendarDays() {
        const grid = document.getElementById('calendarGrid');
        if (!grid) return;
        
        grid.innerHTML = '';
        
        // Get first day of the month and total days
        const firstDay = new Date(this.currentYear, this.currentMonth, 1);
        const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
        const totalDays = lastDay.getDate();
        const startingDay = firstDay.getDay(); // 0 = Sunday
        
        // Add empty cells for days before the first of the month
        for (let i = 0; i < startingDay; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'calendar-day empty';
            grid.appendChild(emptyCell);
        }
        
        // Add cells for each day of the month
        for (let day = 1; day <= totalDays; day++) {
            const dayCell = this.createDayCell(day);
            grid.appendChild(dayCell);
        }
    }

    /**
     * Create a single day cell with P&L data
     */
    createDayCell(day) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day';
        
        const dateKey = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayData = this.dailyPnL[dateKey];
        
        // Check if this is today
        const today = new Date();
        if (this.currentYear === today.getFullYear() && 
            this.currentMonth === today.getMonth() && 
            day === today.getDate()) {
            cell.classList.add('today');
        }
        
        // Day number
        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = day;
        cell.appendChild(dayNumber);
        
        // P&L data if available
        if (dayData) {
            const profit = dayData.profit;
            const pips = dayData.pips;
            
            if (profit > 0) {
                cell.classList.add('profit-day');
            } else if (profit < 0) {
                cell.classList.add('loss-day');
            } else {
                cell.classList.add('breakeven-day');
            }
            
            // P&L value
            const pnlValue = document.createElement('div');
            pnlValue.className = 'day-pnl ' + (profit >= 0 ? 'positive' : 'negative');
            pnlValue.textContent = this.formatCurrency(profit);
            cell.appendChild(pnlValue);
            
            // Pips value
            const pipsValue = document.createElement('div');
            pipsValue.className = 'day-pips ' + (pips >= 0 ? 'positive' : 'negative');
            pipsValue.textContent = (pips >= 0 ? '+' : '') + pips.toFixed(1) + ' pips';
            cell.appendChild(pipsValue);
            
            // Trade count
            const tradeCount = document.createElement('div');
            tradeCount.className = 'day-trades';
            tradeCount.textContent = `${dayData.trades} trade${dayData.trades !== 1 ? 's' : ''}`;
            cell.appendChild(tradeCount);
            
            // Add tooltip with more details
            cell.title = this.createTooltipText(dayData, dateKey);
        }
        
        return cell;
    }

    /**
     * Create tooltip text for a day
     */
    createTooltipText(dayData, dateKey) {
        const date = new Date(dateKey);
        const formattedDate = date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        const pipsSign = dayData.pips >= 0 ? '+' : '';
        
        return `${formattedDate}\n` +
               `P/L: ${this.formatCurrency(dayData.profit)}\n` +
               `Pips: ${pipsSign}${dayData.pips.toFixed(1)}\n` +
               `Trades: ${dayData.trades}\n` +
               `Wins: ${dayData.wins} | Losses: ${dayData.losses}`;
    }

    /**
     * Format currency value
     */
    formatCurrency(value) {
        const sign = value >= 0 ? '+' : '';
        const symbol = typeof getCurrencySymbol === 'function' ? 
            getCurrencySymbol(typeof currentCurrency !== 'undefined' ? currentCurrency : 'USD') : '$';
        return sign + symbol + Math.abs(value).toFixed(2);
    }

    /**
     * Navigate to a specific month/year
     */
    goToDate(date) {
        this.currentMonth = date.getMonth();
        this.currentYear = date.getFullYear();
        this.render();
    }

    /**
     * Get monthly summary statistics
     */
    getMonthlySummary() {
        let totalProfit = 0;
        let totalTrades = 0;
        let profitDays = 0;
        let lossDays = 0;
        
        for (const [dateKey, data] of Object.entries(this.dailyPnL)) {
            const date = new Date(dateKey);
            if (date.getMonth() === this.currentMonth && date.getFullYear() === this.currentYear) {
                totalProfit += data.profit;
                totalTrades += data.trades;
                if (data.profit > 0) profitDays++;
                if (data.profit < 0) lossDays++;
            }
        }
        
        return {
            totalProfit,
            totalTrades,
            profitDays,
            lossDays,
            tradingDays: profitDays + lossDays
        };
    }
}

// Export calendar manager
window.CalendarManager = CalendarManager;