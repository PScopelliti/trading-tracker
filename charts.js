/**
 * Chart Manager for Trading Stats
 * Creates and manages Chart.js visualizations
 */

class ChartManager {
    constructor() {
        this.charts = {};
        this.defaultOptions = {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    labels: {
                        color: '#8892a4',
                        font: {
                            family: "'Inter', sans-serif"
                        }
                    }
                },
                tooltip: {
                    backgroundColor: '#1e2738',
                    titleColor: '#ffffff',
                    bodyColor: '#8892a4',
                    borderColor: '#2a3548',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(42, 53, 72, 0.5)'
                    },
                    ticks: {
                        color: '#8892a4'
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(42, 53, 72, 0.5)'
                    },
                    ticks: {
                        color: '#8892a4'
                    }
                }
            }
        };
    }

    /**
     * Initialize all charts with stats data
     */
    initializeCharts(stats) {
        this.createEquityChart(stats.equityCurve);
        this.createPnLDistributionChart(stats.pnlDistribution);
        this.createDayOfWeekChart(stats.dayOfWeekPerformance);
        this.createSymbolChart(stats.symbolPerformance);
        this.createHourlyChart(stats.hourlyPerformance);
    }

    /**
     * Destroy all existing charts
     */
    destroyCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        this.charts = {};
    }

    /**
     * Create equity curve chart
     */
    createEquityChart(equityCurve) {
        const ctx = document.getElementById('equityChart');
        if (!ctx) return;

        if (this.charts.equity) {
            this.charts.equity.destroy();
        }

        const labels = equityCurve.map((point, index) => {
            if (point.date) {
                const date = new Date(point.date);
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }
            return `Trade ${index + 1}`;
        });

        const data = equityCurve.map(point => point.equity);

        // Create gradient
        const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
        const finalEquity = data[data.length - 1] || 0;
        
        if (finalEquity >= 0) {
            gradient.addColorStop(0, 'rgba(16, 185, 129, 0.3)');
            gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');
        } else {
            gradient.addColorStop(0, 'rgba(239, 68, 68, 0.3)');
            gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
        }

        this.charts.equity = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Equity',
                    data: data,
                    borderColor: finalEquity >= 0 ? '#10b981' : '#ef4444',
                    backgroundColor: gradient,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: data.length > 50 ? 0 : 3,
                    pointHoverRadius: 6,
                    pointBackgroundColor: finalEquity >= 0 ? '#10b981' : '#ef4444',
                    pointBorderColor: '#1e2738',
                    pointBorderWidth: 2
                }]
            },
            options: {
                ...this.defaultOptions,
                plugins: {
                    ...this.defaultOptions.plugins,
                    legend: {
                        display: false
                    },
                    tooltip: {
                        ...this.defaultOptions.plugins.tooltip,
                        callbacks: {
                            label: (context) => `Equity: $${context.raw.toFixed(2)}`
                        }
                    }
                },
                scales: {
                    ...this.defaultOptions.scales,
                    y: {
                        ...this.defaultOptions.scales.y,
                        ticks: {
                            ...this.defaultOptions.scales.y.ticks,
                            callback: (value) => '$' + value.toFixed(0)
                        }
                    }
                }
            }
        });
    }

    /**
     * Create P&L distribution histogram
     */
    createPnLDistributionChart(distribution) {
        const ctx = document.getElementById('pnlDistribution');
        if (!ctx) return;

        if (this.charts.pnlDist) {
            this.charts.pnlDist.destroy();
        }

        this.charts.pnlDist = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: distribution.bins,
                datasets: [{
                    label: 'Trade Count',
                    data: distribution.counts,
                    backgroundColor: distribution.colors,
                    borderColor: distribution.colors.map(c => c.replace('0.7', '1')),
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                ...this.defaultOptions,
                plugins: {
                    ...this.defaultOptions.plugins,
                    legend: {
                        display: false
                    },
                    tooltip: {
                        ...this.defaultOptions.plugins.tooltip,
                        callbacks: {
                            title: (context) => `P/L Range: $${context[0].label}`,
                            label: (context) => `Trades: ${context.raw}`
                        }
                    }
                },
                scales: {
                    ...this.defaultOptions.scales,
                    x: {
                        ...this.defaultOptions.scales.x,
                        title: {
                            display: true,
                            text: 'Profit/Loss ($)',
                            color: '#8892a4'
                        }
                    },
                    y: {
                        ...this.defaultOptions.scales.y,
                        title: {
                            display: true,
                            text: 'Number of Trades',
                            color: '#8892a4'
                        },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    /**
     * Create day of week performance chart
     */
    createDayOfWeekChart(dayData) {
        const ctx = document.getElementById('dayOfWeekChart');
        if (!ctx) return;

        if (this.charts.dayOfWeek) {
            this.charts.dayOfWeek.destroy();
        }

        // Filter to only weekdays with trading activity
        const tradingDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
        const filteredLabels = dayData.labels.filter((_, i) => i >= 1 && i <= 5);
        const filteredProfits = dayData.profits.filter((_, i) => i >= 1 && i <= 5);
        const filteredCounts = dayData.counts.filter((_, i) => i >= 1 && i <= 5);

        const colors = filteredProfits.map(p => p >= 0 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)');

        this.charts.dayOfWeek = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: tradingDays,
                datasets: [{
                    label: 'Profit/Loss',
                    data: filteredProfits,
                    backgroundColor: colors,
                    borderColor: colors.map(c => c.replace('0.7', '1')),
                    borderWidth: 1,
                    borderRadius: 6,
                    yAxisID: 'y'
                }, {
                    label: 'Trade Count',
                    data: filteredCounts,
                    type: 'line',
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    borderWidth: 2,
                    pointRadius: 4,
                    pointBackgroundColor: '#8b5cf6',
                    yAxisID: 'y1'
                }]
            },
            options: {
                ...this.defaultOptions,
                plugins: {
                    ...this.defaultOptions.plugins,
                    tooltip: {
                        ...this.defaultOptions.plugins.tooltip,
                        callbacks: {
                            label: (context) => {
                                if (context.dataset.label === 'Profit/Loss') {
                                    return `P/L: $${context.raw.toFixed(2)}`;
                                }
                                return `Trades: ${context.raw}`;
                            }
                        }
                    }
                },
                scales: {
                    x: this.defaultOptions.scales.x,
                    y: {
                        ...this.defaultOptions.scales.y,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Profit/Loss ($)',
                            color: '#8892a4'
                        },
                        ticks: {
                            ...this.defaultOptions.scales.y.ticks,
                            callback: (value) => '$' + value.toFixed(0)
                        }
                    },
                    y1: {
                        ...this.defaultOptions.scales.y,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Trade Count',
                            color: '#8892a4'
                        },
                        grid: {
                            drawOnChartArea: false
                        },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    /**
     * Create symbol performance chart
     */
    createSymbolChart(symbolData) {
        const ctx = document.getElementById('symbolChart');
        if (!ctx) return;

        if (this.charts.symbol) {
            this.charts.symbol.destroy();
        }

        const colors = symbolData.profits.map(p => p >= 0 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)');

        this.charts.symbol = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: symbolData.labels,
                datasets: [{
                    label: 'Profit/Loss',
                    data: symbolData.profits,
                    backgroundColor: colors,
                    borderColor: colors.map(c => c.replace('0.7', '1')),
                    borderWidth: 1,
                    borderRadius: 6
                }]
            },
            options: {
                ...this.defaultOptions,
                indexAxis: 'y',
                plugins: {
                    ...this.defaultOptions.plugins,
                    legend: {
                        display: false
                    },
                    tooltip: {
                        ...this.defaultOptions.plugins.tooltip,
                        callbacks: {
                            label: (context) => {
                                const index = context.dataIndex;
                                return [
                                    `P/L: $${context.raw.toFixed(2)}`,
                                    `Trades: ${symbolData.counts[index]}`,
                                    `Win Rate: ${symbolData.winRates[index].toFixed(1)}%`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ...this.defaultOptions.scales.x,
                        title: {
                            display: true,
                            text: 'Profit/Loss ($)',
                            color: '#8892a4'
                        },
                        ticks: {
                            ...this.defaultOptions.scales.x.ticks,
                            callback: (value) => '$' + value.toFixed(0)
                        }
                    },
                    y: this.defaultOptions.scales.y
                }
            }
        });
    }

    /**
     * Create hourly performance chart
     */
    createHourlyChart(hourlyData) {
        const ctx = document.getElementById('hourChart');
        if (!ctx) return;

        if (this.charts.hourly) {
            this.charts.hourly.destroy();
        }

        // Filter to only hours with trading activity
        const activeHours = hourlyData.labels.filter((_, i) => hourlyData.counts[i] > 0);
        const activeProfits = hourlyData.profits.filter((_, i) => hourlyData.counts[i] > 0);
        const activeCounts = hourlyData.counts.filter(c => c > 0);
        const activeWinRates = hourlyData.winRates.filter((_, i) => hourlyData.counts[i] > 0);

        const colors = activeProfits.map(p => p >= 0 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)');

        this.charts.hourly = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: activeHours,
                datasets: [{
                    label: 'Profit/Loss',
                    data: activeProfits,
                    backgroundColor: colors,
                    borderColor: colors.map(c => c.replace('0.7', '1')),
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                ...this.defaultOptions,
                plugins: {
                    ...this.defaultOptions.plugins,
                    legend: {
                        display: false
                    },
                    tooltip: {
                        ...this.defaultOptions.plugins.tooltip,
                        callbacks: {
                            label: (context) => {
                                const index = context.dataIndex;
                                return [
                                    `P/L: $${context.raw.toFixed(2)}`,
                                    `Trades: ${activeCounts[index]}`,
                                    `Win Rate: ${activeWinRates[index].toFixed(1)}%`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    ...this.defaultOptions.scales,
                    x: {
                        ...this.defaultOptions.scales.x,
                        title: {
                            display: true,
                            text: 'Hour (24h)',
                            color: '#8892a4'
                        }
                    },
                    y: {
                        ...this.defaultOptions.scales.y,
                        title: {
                            display: true,
                            text: 'Profit/Loss ($)',
                            color: '#8892a4'
                        },
                        ticks: {
                            ...this.defaultOptions.scales.y.ticks,
                            callback: (value) => '$' + value.toFixed(0)
                        }
                    }
                }
            }
        });
    }
}

// Export chart manager
window.ChartManager = ChartManager;