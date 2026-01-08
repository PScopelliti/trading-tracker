/**
 * Trading Statistics Calculator
 * Calculates key trading metrics from parsed trade data
 */

class StatsCalculator {
    constructor(trades) {
        this.trades = trades || [];
        this.sortedTrades = this.sortTradesByDate(trades);
    }

    /**
     * Sort trades by close time
     */
    sortTradesByDate(trades) {
        return [...trades].sort((a, b) => {
            const dateA = new Date(a.closeTime);
            const dateB = new Date(b.closeTime);
            return dateA - dateB;
        });
    }

    /**
     * Calculate all statistics
     */
    calculateAll() {
        return {
            // Core metrics
            totalTrades: this.getTotalTrades(),
            totalPnL: this.getTotalPnL(),
            netPnL: this.getNetPnL(),
            winRate: this.getWinRate(),
            profitFactor: this.getProfitFactor(),
            
            // Trade counts
            winningTrades: this.getWinningTrades().length,
            losingTrades: this.getLosingTrades().length,
            breakEvenTrades: this.getBreakEvenTrades().length,
            
            // Averages
            avgTrade: this.getAverageTrade(),
            avgWin: this.getAverageWin(),
            avgLoss: this.getAverageLoss(),
            
            // Extremes
            bestTrade: this.getBestTrade(),
            worstTrade: this.getWorstTrade(),
            maxDrawdown: this.getMaxDrawdown(),
            maxDrawdownPercent: this.getMaxDrawdownPercent(),
            
            // Streaks
            maxWinStreak: this.getMaxWinStreak(),
            maxLoseStreak: this.getMaxLoseStreak(),
            
            // Ratios
            riskRewardRatio: this.getRiskRewardRatio(),
            expectancy: this.getExpectancy(),
            
            // Time-based
            avgHoldingTime: this.getAverageHoldingTime(),
            
            // Equity curve data
            equityCurve: this.getEquityCurve(),
            
            // Distributions
            pnlDistribution: this.getPnLDistribution(),
            dayOfWeekPerformance: this.getDayOfWeekPerformance(),
            hourlyPerformance: this.getHourlyPerformance(),
            symbolPerformance: this.getSymbolPerformance()
        };
    }

    /**
     * Get total number of trades
     */
    getTotalTrades() {
        return this.trades.length;
    }

    /**
     * Get total profit/loss (gross)
     */
    getTotalPnL() {
        return this.trades.reduce((sum, trade) => sum + (trade.profit || 0), 0);
    }

    /**
     * Get net profit/loss (including commissions and swaps)
     */
    getNetPnL() {
        return this.trades.reduce((sum, trade) => {
            const netProfit = trade.netProfit !== undefined 
                ? trade.netProfit 
                : (trade.profit || 0) + (trade.commission || 0) + (trade.swap || 0);
            return sum + netProfit;
        }, 0);
    }

    /**
     * Get winning trades
     */
    getWinningTrades() {
        return this.trades.filter(trade => this.getTradeProfit(trade) > 0);
    }

    /**
     * Get losing trades
     */
    getLosingTrades() {
        return this.trades.filter(trade => this.getTradeProfit(trade) < 0);
    }

    /**
     * Get break-even trades
     */
    getBreakEvenTrades() {
        return this.trades.filter(trade => this.getTradeProfit(trade) === 0);
    }

    /**
     * Get trade profit (net or gross)
     */
    getTradeProfit(trade) {
        return trade.netProfit !== undefined ? trade.netProfit : (trade.profit || 0);
    }

    /**
     * Calculate win rate
     */
    getWinRate() {
        if (this.trades.length === 0) return 0;
        const winningTrades = this.getWinningTrades();
        return (winningTrades.length / this.trades.length) * 100;
    }

    /**
     * Calculate profit factor
     */
    getProfitFactor() {
        const wins = this.getWinningTrades();
        const losses = this.getLosingTrades();
        
        const totalWins = wins.reduce((sum, trade) => sum + this.getTradeProfit(trade), 0);
        const totalLosses = Math.abs(losses.reduce((sum, trade) => sum + this.getTradeProfit(trade), 0));
        
        if (totalLosses === 0) return totalWins > 0 ? Infinity : 0;
        return totalWins / totalLosses;
    }

    /**
     * Get average trade
     */
    getAverageTrade() {
        if (this.trades.length === 0) return 0;
        return this.getNetPnL() / this.trades.length;
    }

    /**
     * Get average winning trade
     */
    getAverageWin() {
        const wins = this.getWinningTrades();
        if (wins.length === 0) return 0;
        const total = wins.reduce((sum, trade) => sum + this.getTradeProfit(trade), 0);
        return total / wins.length;
    }

    /**
     * Get average losing trade
     */
    getAverageLoss() {
        const losses = this.getLosingTrades();
        if (losses.length === 0) return 0;
        const total = losses.reduce((sum, trade) => sum + this.getTradeProfit(trade), 0);
        return total / losses.length;
    }

    /**
     * Get best trade
     */
    getBestTrade() {
        if (this.trades.length === 0) return 0;
        return Math.max(...this.trades.map(trade => this.getTradeProfit(trade)));
    }

    /**
     * Get worst trade
     */
    getWorstTrade() {
        if (this.trades.length === 0) return 0;
        return Math.min(...this.trades.map(trade => this.getTradeProfit(trade)));
    }

    /**
     * Calculate maximum drawdown
     */
    getMaxDrawdown() {
        const equityCurve = this.getEquityCurve();
        if (equityCurve.length === 0) return 0;

        let maxDrawdown = 0;
        let peak = equityCurve[0].equity;

        for (const point of equityCurve) {
            if (point.equity > peak) {
                peak = point.equity;
            }
            const drawdown = peak - point.equity;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }
        }

        return maxDrawdown;
    }

    /**
     * Calculate maximum drawdown percentage
     */
    getMaxDrawdownPercent() {
        const equityCurve = this.getEquityCurve();
        if (equityCurve.length === 0) return 0;

        let maxDrawdownPercent = 0;
        let peak = equityCurve[0].equity;

        for (const point of equityCurve) {
            if (point.equity > peak) {
                peak = point.equity;
            }
            if (peak > 0) {
                const drawdownPercent = ((peak - point.equity) / peak) * 100;
                if (drawdownPercent > maxDrawdownPercent) {
                    maxDrawdownPercent = drawdownPercent;
                }
            }
        }

        return maxDrawdownPercent;
    }

    /**
     * Get maximum winning streak
     */
    getMaxWinStreak() {
        let maxStreak = 0;
        let currentStreak = 0;

        for (const trade of this.sortedTrades) {
            if (this.getTradeProfit(trade) > 0) {
                currentStreak++;
                maxStreak = Math.max(maxStreak, currentStreak);
            } else {
                currentStreak = 0;
            }
        }

        return maxStreak;
    }

    /**
     * Get maximum losing streak
     */
    getMaxLoseStreak() {
        let maxStreak = 0;
        let currentStreak = 0;

        for (const trade of this.sortedTrades) {
            if (this.getTradeProfit(trade) < 0) {
                currentStreak++;
                maxStreak = Math.max(maxStreak, currentStreak);
            } else {
                currentStreak = 0;
            }
        }

        return maxStreak;
    }

    /**
     * Calculate risk/reward ratio
     */
    getRiskRewardRatio() {
        const avgWin = this.getAverageWin();
        const avgLoss = Math.abs(this.getAverageLoss());
        
        if (avgLoss === 0) return avgWin > 0 ? Infinity : 0;
        return avgWin / avgLoss;
    }

    /**
     * Calculate expectancy
     */
    getExpectancy() {
        const winRate = this.getWinRate() / 100;
        const avgWin = this.getAverageWin();
        const avgLoss = Math.abs(this.getAverageLoss());
        
        return (winRate * avgWin) - ((1 - winRate) * avgLoss);
    }

    /**
     * Calculate average holding time
     */
    getAverageHoldingTime() {
        const tradesWithTime = this.trades.filter(trade => 
            trade.openTime && trade.closeTime
        );

        if (tradesWithTime.length === 0) {
            return { hours: 0, minutes: 0, formatted: '0h 0m' };
        }

        const totalMs = tradesWithTime.reduce((sum, trade) => {
            const open = new Date(trade.openTime);
            const close = new Date(trade.closeTime);
            return sum + (close - open);
        }, 0);

        const avgMs = totalMs / tradesWithTime.length;
        const hours = Math.floor(avgMs / (1000 * 60 * 60));
        const minutes = Math.floor((avgMs % (1000 * 60 * 60)) / (1000 * 60));

        return {
            hours,
            minutes,
            formatted: `${hours}h ${minutes}m`
        };
    }

    /**
     * Generate equity curve data
     */
    getEquityCurve() {
        const curve = [];
        let equity = 0;

        for (const trade of this.sortedTrades) {
            equity += this.getTradeProfit(trade);
            curve.push({
                date: trade.closeTime,
                equity: equity,
                trade: trade
            });
        }

        return curve;
    }

    /**
     * Get P&L distribution for histogram
     */
    getPnLDistribution() {
        const profits = this.trades.map(trade => this.getTradeProfit(trade));
        
        if (profits.length === 0) return { bins: [], counts: [] };

        const min = Math.min(...profits);
        const max = Math.max(...profits);
        const range = max - min;
        const binCount = Math.min(20, Math.ceil(Math.sqrt(profits.length)));
        const binSize = range / binCount;

        const bins = [];
        const counts = [];
        const colors = [];

        for (let i = 0; i < binCount; i++) {
            const binStart = min + (i * binSize);
            const binEnd = binStart + binSize;
            const binCenter = (binStart + binEnd) / 2;
            
            bins.push(binCenter.toFixed(2));
            counts.push(profits.filter(p => p >= binStart && p < binEnd).length);
            colors.push(binCenter >= 0 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)');
        }

        return { bins, counts, colors };
    }

    /**
     * Get performance by day of week
     */
    getDayOfWeekPerformance() {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const performance = days.map(() => ({ profit: 0, count: 0, wins: 0 }));

        for (const trade of this.trades) {
            const date = new Date(trade.closeTime);
            const dayIndex = date.getDay();
            performance[dayIndex].profit += this.getTradeProfit(trade);
            performance[dayIndex].count++;
            if (this.getTradeProfit(trade) > 0) {
                performance[dayIndex].wins++;
            }
        }

        return {
            labels: days,
            profits: performance.map(p => p.profit),
            counts: performance.map(p => p.count),
            winRates: performance.map(p => p.count > 0 ? (p.wins / p.count) * 100 : 0)
        };
    }

    /**
     * Get hourly performance
     */
    getHourlyPerformance() {
        const hours = Array.from({ length: 24 }, (_, i) => i);
        const performance = hours.map(() => ({ profit: 0, count: 0, wins: 0 }));

        for (const trade of this.trades) {
            const date = new Date(trade.openTime);
            const hour = date.getHours();
            performance[hour].profit += this.getTradeProfit(trade);
            performance[hour].count++;
            if (this.getTradeProfit(trade) > 0) {
                performance[hour].wins++;
            }
        }

        return {
            labels: hours.map(h => `${h}:00`),
            profits: performance.map(p => p.profit),
            counts: performance.map(p => p.count),
            winRates: performance.map(p => p.count > 0 ? (p.wins / p.count) * 100 : 0)
        };
    }

    /**
     * Get performance by symbol
     */
    getSymbolPerformance() {
        const symbolData = {};

        for (const trade of this.trades) {
            const symbol = trade.symbol || 'UNKNOWN';
            if (!symbolData[symbol]) {
                symbolData[symbol] = { profit: 0, count: 0, wins: 0, volume: 0 };
            }
            symbolData[symbol].profit += this.getTradeProfit(trade);
            symbolData[symbol].count++;
            symbolData[symbol].volume += trade.volume || 0;
            if (this.getTradeProfit(trade) > 0) {
                symbolData[symbol].wins++;
            }
        }

        // Sort by trade count and get top 10
        const sorted = Object.entries(symbolData)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 10);

        return {
            labels: sorted.map(([symbol]) => symbol),
            profits: sorted.map(([, data]) => data.profit),
            counts: sorted.map(([, data]) => data.count),
            winRates: sorted.map(([, data]) => (data.wins / data.count) * 100)
        };
    }
}

// Export calculator
window.StatsCalculator = StatsCalculator;