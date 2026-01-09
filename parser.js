/**
 * MT4/MT5 Trade History Parser
 * Supports CSV and HTML export formats from MetaTrader
 */

class TradeParser {
    constructor() {
        this.trades = [];
        this.currency = 'USD'; // Default currency, will be detected from file
        this.accountInfo = {};
    }

    /**
     * Parse file based on its type
     */
    async parseFile(file) {
        const fileName = file.name.toLowerCase();
        const content = await this.readFileContent(file);
        
        if (fileName.endsWith('.csv')) {
            return this.parseCSV(content);
        } else if (fileName.endsWith('.html') || fileName.endsWith('.htm')) {
            return this.parseHTML(content);
        } else {
            throw new Error('Unsupported file format. Please upload CSV or HTML files.');
        }
    }

    /**
     * Read file content as text
     * Handles UTF-16 encoded files (common in MT4/MT5 exports)
     */
    readFileContent(file) {
        return new Promise((resolve, reject) => {
            // For HTML files, try UTF-16 first since MT5 exports are often UTF-16 LE
            const isHtml = file.name.toLowerCase().endsWith('.html') || file.name.toLowerCase().endsWith('.htm');
            
            if (isHtml) {
                // Read as ArrayBuffer first to check encoding
                const reader = new FileReader();
                reader.onload = (e) => {
                    const arrayBuffer = e.target.result;
                    const bytes = new Uint8Array(arrayBuffer);
                    
                    console.log('First 10 bytes:', Array.from(bytes.slice(0, 10)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
                    
                    // Check for UTF-16 LE BOM: 0xFF 0xFE
                    if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
                        console.log('Detected UTF-16 LE BOM');
                        const decoder = new TextDecoder('utf-16le');
                        const content = decoder.decode(arrayBuffer);
                        console.log('Content starts with:', content.substring(0, 100));
                        resolve(content);
                        return;
                    }
                    
                    // Check for UTF-16 BE BOM: 0xFE 0xFF
                    if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
                        console.log('Detected UTF-16 BE BOM');
                        const decoder = new TextDecoder('utf-16be');
                        const content = decoder.decode(arrayBuffer);
                        resolve(content);
                        return;
                    }
                    
                    // Check for UTF-16 LE without BOM (common pattern: ASCII char followed by 0x00)
                    // Look for pattern: [valid ASCII][0x00][valid ASCII][0x00]...
                    let utf16LePattern = 0;
                    for (let i = 0; i < Math.min(100, bytes.length - 1); i += 2) {
                        if (bytes[i] >= 0x20 && bytes[i] <= 0x7E && bytes[i + 1] === 0x00) {
                            utf16LePattern++;
                        }
                    }
                    
                    if (utf16LePattern > 20) {
                        console.log('Detected UTF-16 LE pattern without BOM');
                        const decoder = new TextDecoder('utf-16le');
                        const content = decoder.decode(arrayBuffer);
                        resolve(content);
                        return;
                    }
                    
                    // Fall back to UTF-8
                    console.log('Using UTF-8 encoding');
                    const decoder = new TextDecoder('utf-8');
                    const content = decoder.decode(arrayBuffer);
                    resolve(content);
                };
                reader.onerror = (e) => reject(new Error('Failed to read file'));
                reader.readAsArrayBuffer(file);
            } else {
                // For non-HTML files, use default text reading
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (e) => reject(new Error('Failed to read file'));
                reader.readAsText(file);
            }
        });
    }

    /**
     * Parse CSV format from MT4/MT5
     * Typical format: Ticket, Open Time, Type, Size, Symbol, Open Price, S/L, T/P, Close Time, Close Price, Commission, Swap, Profit
     */
    parseCSV(content) {
        const lines = content.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
            throw new Error('CSV file appears to be empty');
        }

        // Try to detect header row and column mapping
        const headerRow = lines[0].toLowerCase();
        let columnMap = this.detectCSVColumns(headerRow);
        
        const trades = [];
        const startIndex = columnMap ? 1 : 0;

        for (let i = startIndex; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            if (values.length < 5) continue;

            try {
                const trade = columnMap 
                    ? this.mapColumnsToTrade(values, columnMap)
                    : this.parseGenericCSVRow(values);
                
                if (trade && this.isValidTrade(trade)) {
                    trades.push(trade);
                }
            } catch (e) {
                console.warn(`Skipping invalid row ${i}:`, e.message);
            }
        }

        if (trades.length === 0) {
            throw new Error('No valid trades found in CSV file');
        }

        return trades;
    }

    /**
     * Parse a CSV line handling quoted values
     */
    parseCSVLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;

        for (let char of line) {
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if ((char === ',' || char === ';' || char === '\t') && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim());
        return values;
    }

    /**
     * Detect CSV column mapping from header
     */
    detectCSVColumns(header) {
        const columns = this.parseCSVLine(header);
        const map = {};

        const patterns = {
            ticket: /ticket|order|deal/i,
            openTime: /open\s*time|time\s*open|entry\s*time/i,
            closeTime: /close\s*time|time\s*close|exit\s*time/i,
            type: /type|direction|side/i,
            volume: /volume|size|lots?/i,
            symbol: /symbol|instrument|pair/i,
            openPrice: /open\s*price|entry\s*price|price\s*open/i,
            closePrice: /close\s*price|exit\s*price|price\s*close/i,
            profit: /profit|p[\/&]?l|pnl|result|gross/i,
            commission: /commission|comm/i,
            swap: /swap|rollover/i,
            sl: /s[\/]?l|stop\s*loss/i,
            tp: /t[\/]?p|take\s*profit/i
        };

        columns.forEach((col, index) => {
            for (const [key, pattern] of Object.entries(patterns)) {
                if (pattern.test(col) && map[key] === undefined) {
                    map[key] = index;
                }
            }
        });

        // Check if we have minimum required columns
        if (map.symbol !== undefined && map.profit !== undefined) {
            return map;
        }
        return null;
    }

    /**
     * Map CSV columns to trade object using column map
     */
    mapColumnsToTrade(values, map) {
        const trade = {
            ticket: map.ticket !== undefined ? values[map.ticket] : Date.now().toString(),
            symbol: map.symbol !== undefined ? values[map.symbol] : 'UNKNOWN',
            type: map.type !== undefined ? this.normalizeType(values[map.type]) : 'buy',
            volume: map.volume !== undefined ? parseFloat(values[map.volume]) || 0.01 : 0.01,
            openPrice: map.openPrice !== undefined ? parseFloat(values[map.openPrice]) || 0 : 0,
            closePrice: map.closePrice !== undefined ? parseFloat(values[map.closePrice]) || 0 : 0,
            profit: map.profit !== undefined ? parseFloat(values[map.profit]) || 0 : 0,
            commission: map.commission !== undefined ? parseFloat(values[map.commission]) || 0 : 0,
            swap: map.swap !== undefined ? parseFloat(values[map.swap]) || 0 : 0,
            openTime: map.openTime !== undefined ? this.parseDate(values[map.openTime]) : new Date(),
            closeTime: map.closeTime !== undefined ? this.parseDate(values[map.closeTime]) : new Date()
        };

        // Calculate net profit
        trade.netProfit = trade.profit + trade.commission + trade.swap;
        
        return trade;
    }

    /**
     * Parse generic CSV row (fallback)
     */
    parseGenericCSVRow(values) {
        // Try common MT4 format: Ticket, Open Time, Type, Size, Symbol, Open Price, S/L, T/P, Close Time, Close Price, Commission, Swap, Profit
        if (values.length >= 13) {
            return {
                ticket: values[0],
                openTime: this.parseDate(values[1]),
                type: this.normalizeType(values[2]),
                volume: parseFloat(values[3]) || 0.01,
                symbol: values[4],
                openPrice: parseFloat(values[5]) || 0,
                closeTime: this.parseDate(values[8]),
                closePrice: parseFloat(values[9]) || 0,
                commission: parseFloat(values[10]) || 0,
                swap: parseFloat(values[11]) || 0,
                profit: parseFloat(values[12]) || 0,
                netProfit: (parseFloat(values[12]) || 0) + (parseFloat(values[10]) || 0) + (parseFloat(values[11]) || 0)
            };
        }

        // Try simpler format: Symbol, Type, Volume, OpenPrice, ClosePrice, Profit
        if (values.length >= 6) {
            const profit = parseFloat(values[values.length - 1]) || 0;
            return {
                ticket: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                symbol: values[0],
                type: this.normalizeType(values[1]),
                volume: parseFloat(values[2]) || 0.01,
                openPrice: parseFloat(values[3]) || 0,
                closePrice: parseFloat(values[4]) || 0,
                profit: profit,
                commission: 0,
                swap: 0,
                netProfit: profit,
                openTime: new Date(),
                closeTime: new Date()
            };
        }

        return null;
    }

    /**
     * Parse HTML export from MT4/MT5
     */
    parseHTML(content) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');
        
        // Extract account info and currency first
        this.extractAccountInfo(doc);
        
        console.log('Detected currency:', this.currency);
        
        // Try MT5-specific parsing first
        const mt5Trades = this.parseMT5Report(doc);
        if (mt5Trades.length > 0) {
            console.log('Parsed MT5 trades:', mt5Trades.length);
            mt5Trades.currency = this.currency;
            mt5Trades.accountInfo = this.accountInfo;
            return mt5Trades;
        }

        // Fallback to generic HTML table parsing
        const tables = doc.querySelectorAll('table');
        let trades = [];

        for (const table of tables) {
            const rows = table.querySelectorAll('tr');
            if (rows.length < 2) continue;

            const tableTrades = this.parseHTMLTable(rows);
            if (tableTrades.length > 0) {
                trades = trades.concat(tableTrades);
            }
        }

        if (trades.length === 0) {
            throw new Error('No valid trades found in HTML file');
        }

        // Attach currency info to result
        trades.currency = this.currency;
        trades.accountInfo = this.accountInfo;

        return trades;
    }

    /**
     * Extract account info from MT5 HTML report
     */
    extractAccountInfo(doc) {
        const allText = doc.body ? doc.body.textContent : '';
        
        // Look for currency in account info - format: "52061359 (GBP, PepperstoneUK-Live, real, Hedge)"
        const currencyMatch = allText.match(/\d+\s*\(\s*(USD|EUR|GBP|JPY|AUD|CAD|CHF|NZD)[,\s]/i);
        if (currencyMatch) {
            this.currency = currencyMatch[1].toUpperCase();
            console.log('Currency extracted:', this.currency);
        }
        
        // Extract account number
        const accountMatch = allText.match(/Account:\s*(\d+)/i);
        if (accountMatch) {
            this.accountInfo.accountNumber = accountMatch[1];
        }
        
        // Extract name
        const nameMatch = allText.match(/Name:\s*([^<\n]+)/i);
        if (nameMatch) {
            this.accountInfo.name = nameMatch[1].trim();
        }
    }

    /**
     * Parse MT5 Report - looks for Positions section specifically
     */
    parseMT5Report(doc) {
        const trades = [];
        const allRows = doc.querySelectorAll('tr');
        
        let inPositionsSection = false;
        let positionsHeaderFound = false;

        for (let i = 0; i < allRows.length; i++) {
            const row = allRows[i];
            const rowText = row.textContent;
            
            // Look for "Positions" section header (the section title, not the column header)
            const thElements = row.querySelectorAll('th');
            for (const th of thElements) {
                const thText = th.textContent.trim();
                if (thText === 'Positions') {
                    inPositionsSection = true;
                    console.log('Found Positions section');
                    continue;
                }
                // Detect end of Positions section
                if (inPositionsSection && (thText === 'Orders' || thText === 'Deals' || thText === 'Results')) {
                    console.log('End of Positions section, found:', thText);
                    inPositionsSection = false;
                    positionsHeaderFound = false;
                }
            }

            if (!inPositionsSection) continue;

            // Look for the Positions table header row
            const cells = row.querySelectorAll('td, th');
            if (cells.length > 0) {
                const firstCellText = cells[0].textContent.trim();
                if (firstCellText === 'Time' && rowText.includes('Position') && rowText.includes('Symbol')) {
                    positionsHeaderFound = true;
                    console.log('Found Positions header row');
                    continue;
                }
            }

            if (!positionsHeaderFound) continue;

            // Now we're parsing data rows
            const dataCells = row.querySelectorAll('td');
            if (dataCells.length < 5) continue;

            // Build visible cell values, skipping hidden cells
            // Check both className and classList for 'hidden'
            const visibleValues = [];
            for (const cell of dataCells) {
                const className = cell.getAttribute('class') || '';
                if (className.includes('hidden')) continue;
                visibleValues.push(cell.textContent.trim());
            }

            console.log('Row cells:', dataCells.length, 'visible:', visibleValues.length, 'values:', visibleValues.slice(0, 5).join(', '));

            // MT5 Positions row structure (after filtering hidden):
            // 0: OpenTime, 1: PositionID, 2: Symbol, 3: Type, 4: Volume,
            // 5: OpenPrice, 6: S/L, 7: T/P, 8: CloseTime, 9: ClosePrice,
            // 10: Commission, 11: Swap, 12: Profit
            
            if (visibleValues.length < 13) continue;

            const symbol = visibleValues[2];
            const type = visibleValues[3].toLowerCase();

            // Must be buy or sell
            if (type !== 'buy' && type !== 'sell') {
                console.log('Skipping non-trade row, type:', type);
                continue;
            }

            try {
                const profit = this.parseNumber(visibleValues[12]);
                
                const trade = {
                    ticket: visibleValues[1],
                    symbol: symbol,
                    type: type,
                    volume: this.parseNumber(visibleValues[4]),
                    openPrice: this.parseNumber(visibleValues[5]),
                    sl: this.parseNumber(visibleValues[6]),
                    tp: this.parseNumber(visibleValues[7]),
                    closeTime: this.parseDate(visibleValues[8]),
                    closePrice: this.parseNumber(visibleValues[9]),
                    commission: this.parseNumber(visibleValues[10]),
                    swap: this.parseNumber(visibleValues[11]),
                    profit: profit,
                    openTime: this.parseDate(visibleValues[0])
                };

                trade.netProfit = trade.profit + trade.commission + trade.swap;

                console.log('Parsed trade:', trade.symbol, trade.type, 'profit:', trade.profit, 'netProfit:', trade.netProfit);
                trades.push(trade);
            } catch (e) {
                console.warn('Error parsing trade row:', e.message);
            }
        }

        console.log('Total MT5 trades parsed:', trades.length);
        return trades;
    }

    /**
     * Parse number from string, handling spaces and different formats
     */
    parseNumber(value) {
        if (!value) return 0;
        // Remove spaces (thousands separator in some locales) and parse
        const cleaned = value.toString().replace(/\s/g, '').replace(',', '.');
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
    }

    /**
     * Parse HTML table rows for trade data (generic fallback)
     */
    parseHTMLTable(rows) {
        const trades = [];
        let headerMap = null;

        for (let i = 0; i < rows.length; i++) {
            const cells = rows[i].querySelectorAll('td, th');
            if (cells.length < 4) continue;

            // Filter out hidden cells
            const visibleCells = Array.from(cells).filter(cell => !cell.classList.contains('hidden'));
            const cellValues = visibleCells.map(cell => cell.textContent.trim());
            
            // Try to detect header row
            if (!headerMap && this.isHeaderRow(cellValues)) {
                headerMap = this.detectHTMLColumns(cellValues);
                continue;
            }

            // Skip non-trade rows
            if (this.isNonTradeRow(cellValues)) continue;

            try {
                const trade = headerMap
                    ? this.mapColumnsToTrade(cellValues, headerMap)
                    : this.parseGenericHTMLRow(cellValues);

                if (trade && this.isValidTrade(trade)) {
                    trades.push(trade);
                }
            } catch (e) {
                console.warn(`Skipping row:`, e.message);
            }
        }

        return trades;
    }

    /**
     * Check if row is a header row
     */
    isHeaderRow(values) {
        const headerKeywords = ['ticket', 'symbol', 'type', 'volume', 'profit', 'time', 'price', 'order'];
        const text = values.join(' ').toLowerCase();
        return headerKeywords.some(keyword => text.includes(keyword));
    }

    /**
     * Detect HTML table column mapping
     */
    detectHTMLColumns(values) {
        const map = {};
        const patterns = {
            ticket: /ticket|order|deal|#/i,
            openTime: /open\s*time|time|entry/i,
            closeTime: /close\s*time|exit/i,
            type: /type|direction|side/i,
            volume: /volume|size|lots?/i,
            symbol: /symbol|instrument|pair/i,
            openPrice: /open\s*price|entry/i,
            closePrice: /close\s*price|exit/i,
            profit: /profit|p[\/&]?l|pnl|result/i,
            commission: /commission|comm/i,
            swap: /swap/i
        };

        values.forEach((val, index) => {
            for (const [key, pattern] of Object.entries(patterns)) {
                if (pattern.test(val) && map[key] === undefined) {
                    map[key] = index;
                }
            }
        });

        return Object.keys(map).length >= 3 ? map : null;
    }

    /**
     * Parse generic HTML row
     */
    parseGenericHTMLRow(values) {
        // Filter out empty values and look for patterns
        const cleaned = values.filter(v => v.trim());
        
        // Look for profit value (usually last numeric value with currency or +/-)
        let profitIndex = -1;
        for (let i = cleaned.length - 1; i >= 0; i--) {
            if (/^-?\$?[\d\s]+\.?\d*$/.test(cleaned[i].replace(/\s/g, ''))) {
                profitIndex = i;
                break;
            }
        }

        if (profitIndex === -1) return null;

        // Try to extract symbol (usually contains currency pair format like EURUSD)
        let symbol = 'UNKNOWN';
        for (const val of cleaned) {
            if (/^[A-Z]{6,}$/i.test(val) || /[A-Z]{3}[\/]?[A-Z]{3}/i.test(val)) {
                symbol = val.toUpperCase();
                break;
            }
        }

        // Extract type
        let type = 'buy';
        for (const val of cleaned) {
            if (/sell|short/i.test(val)) {
                type = 'sell';
                break;
            }
        }

        const profit = parseFloat(cleaned[profitIndex].replace(/[^\d.-]/g, '')) || 0;

        return {
            ticket: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            symbol: symbol,
            type: type,
            volume: 0.01,
            openPrice: 0,
            closePrice: 0,
            profit: profit,
            commission: 0,
            swap: 0,
            netProfit: profit,
            openTime: new Date(),
            closeTime: new Date()
        };
    }

    /**
     * Check if row is a non-trade row (summary, balance, etc.)
     */
    isNonTradeRow(values) {
        const text = values.join(' ').toLowerCase();
        const skipPatterns = [
            /balance/i,
            /deposit/i,
            /withdraw/i,
            /^total/i,
            /closed p\/l/i,
            /summary/i,
            /credit/i,
            /rebate/i
        ];
        return skipPatterns.some(pattern => pattern.test(text));
    }

    /**
     * Normalize trade type
     */
    normalizeType(value) {
        const type = value.toString().toLowerCase().trim();
        if (type.includes('sell') || type.includes('short') || type === 'sell' || type === '1') {
            return 'sell';
        }
        return 'buy';
    }

    /**
     * Parse date from various formats
     */
    parseDate(value) {
        if (!value) return new Date();
        
        // Try direct parsing
        let date = new Date(value);
        if (!isNaN(date.getTime())) return date;

        // Try MT4/MT5 format: YYYY.MM.DD HH:MM:SS
        const mt4Match = value.match(/(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2}):?(\d{2})?/);
        if (mt4Match) {
            return new Date(
                parseInt(mt4Match[1]),
                parseInt(mt4Match[2]) - 1,
                parseInt(mt4Match[3]),
                parseInt(mt4Match[4]),
                parseInt(mt4Match[5]),
                parseInt(mt4Match[6] || 0)
            );
        }

        // Try DD.MM.YYYY format
        const euMatch = value.match(/(\d{2})\.(\d{2})\.(\d{4})/);
        if (euMatch) {
            return new Date(
                parseInt(euMatch[3]),
                parseInt(euMatch[2]) - 1,
                parseInt(euMatch[1])
            );
        }

        return new Date();
    }

    /**
     * Validate trade object
     */
    isValidTrade(trade) {
        if (!trade) return false;
        if (!trade.symbol || trade.symbol === 'UNKNOWN') return false;
        if (typeof trade.profit !== 'number' && typeof trade.netProfit !== 'number') return false;
        return true;
    }
}

// Export parser
window.TradeParser = TradeParser;