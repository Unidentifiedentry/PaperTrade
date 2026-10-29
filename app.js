// INITIAL DATA MATRIX
const INITIAL_STOCKS = {
    AAPL: { name: "Apple Inc.", price: 175.00, change: 0, history: [175.00] },
    TSLA: { name: "Tesla Inc.", price: 240.00, change: 0, history: [240.00] },
    AMZN: { name: "Amazon.com Inc.", price: 130.00, change: 0, history: [130.00] },
    MSFT: { name: "Microsoft Corp.", price: 330.00, change: 0, history: [330.00] },
    NVDA: { name: "NVIDIA Corp.", price: 450.00, change: 0, history: [450.00] }
};

let stocks = JSON.parse(JSON.stringify(INITIAL_STOCKS));
let currentUser = null;
let isSignUpMode = false;

// INTERFACE NAVIGATION & STATE MANAGEMENT
function toggleAuthMode() {
    isSignUpMode = !isSignUpMode;
    document.getElementById("auth-title").innerText = isSignUpMode ? "Create Account" : "Login to PaperTrader";
    document.getElementById("auth-btn").innerText = isSignUpMode ? "Sign Up" : "Log In";
    document.getElementById("auth-toggle").innerHTML = isSignUpMode ? 
        `Already have an account? <span onclick="toggleAuthMode()">Log In</span>` : 
        `Don't have an account? <span onclick="toggleAuthMode()">Sign Up</span>`;
}

// SIMULATED AUTHENTICATION ENGINE
document.getElementById("auth-form").addEventListener("submit", function(e) {
    e.preventDefault();
    const user = document.getElementById("username").value.trim();
    const pass = document.getElementById("password").value;
    
    if (isSignUpMode) {
        if (localStorage.getItem(`user_${user}`)) {
            alert("Username already exists!");
            return;
        }
        const accountData = {
            username: user,
            password: pass, // In production, never store raw passwords
            cash: 100000.00,
            holdings: {}, // e.g., { AAPL: { shares: 10, avgCost: 175.00 } }
            watchlist: [],
            history: []
        };
        localStorage.setItem(`user_${user}`, JSON.stringify(accountData));
        alert("Account created successfully! Please log in.");
        toggleAuthMode();
    } else {
        const storedUser = localStorage.getItem(`user_${user}`);
        if (!storedUser || JSON.parse(storedUser).password !== pass) {
            alert("Invalid credentials!");
            return;
        }
        sessionStorage.setItem("activeUser", user);
        checkSession();
    }
});

function checkSession() {
    const sessionUser = sessionStorage.getItem("activeUser");
    if (sessionUser) {
        currentUser = sessionUser;
        document.getElementById("auth-screen").classList.add("hidden");
        document.getElementById("app-screen").classList.remove("hidden");
        document.getElementById("user-display").innerText = `Logged in as: ${currentUser}`;
        renderStockWatchlist();
        renderStockDirectory();
        updateUI();
    } else {
        document.getElementById("auth-screen").classList.remove("hidden");
        document.getElementById("app-screen").classList.add("hidden");
    }
}

function logout() {
    sessionStorage.removeItem("activeUser");
    currentUser = null;
    checkSession();
}

// MARKET SIMULATION MECHANICS (RANDOM WALK)
function startMarketEngine() {
    setInterval(() => {
        for (let ticker in stocks) {
            const currentPrice = stocks[ticker].price;
            // Generate a random variance between -1.5% and +1.5%
            const variancePercent = (Math.random() * 3 - 1.5) / 100;
            const priceChange = currentPrice * variancePercent;
            
            stocks[ticker].price = Math.max(1.00, +(currentPrice + priceChange).toFixed(2));
            stocks[ticker].change = +variancePercent.toFixed(4);

            // Keep the latest 30 prices for each stock chart.
            stocks[ticker].history.push(stocks[ticker].price);
            if (stocks[ticker].history.length > 30) {
                stocks[ticker].history.shift();
            }
        }
        updateTickerDisplay();
        renderStockWatchlist();
        renderStockDirectory();
        if (currentTicker) renderStockDetail(currentTicker);
        if (currentUser) updateUI();
    }, 3000); // Ticks market every 3 seconds
}

function initializeStockSelect() {
    const select = document.getElementById("stock-select");
    select.innerHTML = "";
    for (let ticker in stocks) {
        select.innerHTML += `<option value="${ticker}">${ticker} - $${stocks[ticker].price.toFixed(2)}</option>`;
    }
    updateTradePreview();
}

function updateTickerDisplay() {
    const tickerBar = document.getElementById("ticker");
    tickerBar.innerHTML = "";
    for (let ticker in stocks) {
        const sign = stocks[ticker].change >= 0 ? "+" : "";
        const colorClass = stocks[ticker].change >= 0 ? "up" : "down";
        tickerBar.innerHTML += `
            <span class="ticker-item">
                <strong>${ticker}</strong>: $${stocks[ticker].price.toFixed(2)} 
                <span class="${colorClass}">(${sign}${(stocks[ticker].change * 100).toFixed(2)}%)</span>
            </span>`;    
    }
}

// TRADE LEDGER & MATH OPERATIONS
function getUserData() {
    return JSON.parse(localStorage.getItem(`user_${currentUser}`));
}

function saveUserData(data) {
    localStorage.setItem(`user_${currentUser}`, JSON.stringify(data));
}

function updateTradePreview() {
    const ticker = document.getElementById("stock-select").value;
    const qtyInput = document.getElementById("trade-quantity").value;
    const qty = Number(qtyInput);
    if (!ticker) return;
    const estCost = stocks[ticker].price * qty;
    document.getElementById("trade-preview").innerText = `$${estCost.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
}

function executeOrder(type, tickerOverride = null, quantityInputId = "trade-quantity") {
    const ticker = tickerOverride || document.getElementById("stock-select").value;
    const qtyInput = document.getElementById(quantityInputId).value;
    const qty = Number(qtyInput);

    if (
        qtyInput.trim() === "" ||
        !Number.isFinite(qty) ||
        !Number.isInteger(qty) ||
        qty <= 0
    ) {
        alert("Enter a valid whole-number quantity.");
        return;
    }

    let userData = getUserData();
    const marketPrice = stocks[ticker].price;
    const totalCost = marketPrice * qty;

    if (type === "BUY") {
        if (userData.cash < totalCost) {
            alert("Insufficient funds configuration!");
            return;
        }
        userData.cash -= totalCost;
        
        if (!userData.holdings[ticker]) {
            userData.holdings[ticker] = { shares: 0, avgCost: 0 };
        }
        
        // Calculate new Dollar-Cost Average
        const currentHoldings = userData.holdings[ticker];
        const newTotalCost = (currentHoldings.shares * currentHoldings.avgCost) + totalCost;
        currentHoldings.shares += qty;
        currentHoldings.avgCost = +(newTotalCost / currentHoldings.shares).toFixed(2);
        
    } else if (type === "SELL") {
        if (!userData.holdings[ticker] || userData.holdings[ticker].shares < qty) {
            alert("Not enough shares to complete execution.");
            return;
        }
        userData.cash += totalCost;
        userData.holdings[ticker].shares -= qty;
        
        if (userData.holdings[ticker].shares === 0) {
            delete userData.holdings[ticker];
        }
    }

    // Log transaction record
    userData.history.unshift({
        type, ticker, qty, price: marketPrice, date: new Date().toLocaleTimeString()
    });

    saveUserData(userData);
    updateUI();
    if (currentTicker === ticker) renderStockDetail(ticker);
    alert(`Order Filled: ${type} ${qty} ${ticker} at $${marketPrice}`);
}

// UI RENDERING SYNCHRONIZATION
function updateUI() {
    let userData = getUserData();
    if (!userData) return;

    let totalHoldingsValue = 0;
    const holdingsTableBody = document.getElementById("holdings-list");
    holdingsTableBody.innerHTML = "";

    // Process portfolio holdings data grid
    for (let ticker in userData.holdings) {
        const shareCount = userData.holdings[ticker].shares;
        const avgCost = userData.holdings[ticker].avgCost;
        const currentPrice = stocks[ticker].price;
        const marketValue = shareCount * currentPrice;
        totalHoldingsValue += marketValue;

        holdingsTableBody.innerHTML += `
            <tr>
                <td><strong>${ticker}</strong></td>
                <td>${shareCount}</td>
                <td>$${avgCost.toFixed(2)}</td>
                <td>$${currentPrice.toFixed(2)}</td>
                <td>$${marketValue.toFixed(2)}</td>
            </tr>`;
    }

    // Process Net Worth & balances calculations
    const netWorth = userData.cash + totalHoldingsValue;
    document.getElementById("cash-balance").innerText = `$${userData.cash.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    document.getElementById("net-worth").innerText = `$${netWorth.toLocaleString(undefined, {minimumFractionDigits: 2})}`;

    // Re-render transactional order history
    const historyLog = document.getElementById("history-log");
    historyLog.innerHTML = "";
    userData.history.forEach(log => {
        historyLog.innerHTML += `<li>[${log.date}] <b>${log.type}</b> ${log.qty} shares of ${log.ticker} @ $${log.price.toFixed(2)}</li>`;
    });
    
    updateTradePreview();
}

function renderStockWatchlist() {
    const container = document.getElementById("stock-watchlist");
    if (!container) return;
    const watched = currentUser ? (getUserData()?.watchlist || []) : [];
    const entries = watched.filter(ticker => stocks[ticker]).map(ticker => [ticker, stocks[ticker]]);
    container.innerHTML = entries.length ? entries.map(
        ([ticker, stock]) => {
            const positive = stock.change >= 0;
            const sign = positive ? "+" : "";

            return `
                <article class="stock-watch-card">
                    <div class="stock-watch-header">
                        <div>
                            <div class="stock-symbol">${ticker}</div>
                            <div class="stock-company">${stock.name}</div>
                        </div>
                        <span class="stock-change ${positive ? "up" : "down"}">
                            ${sign}${(stock.change * 100).toFixed(2)}%
                        </span>
                    </div>

                    <div class="stock-price">
                        $${stock.price.toFixed(2)}
                    </div>

                    <div class="watch-card-actions">
                        <button class="btn-primary" type="button" onclick="showStockDetail('${ticker}')">Open stock</button>
                        <button class="btn-stop-watching" type="button" aria-label="Stop watching ${ticker}" title="Stop watching ${ticker}" onclick="toggleWatch('${ticker}')"><span aria-hidden="true">×</span><span>Stop watching</span></button>
                    </div>
                </article>
            `;
        }
    ).join("") : '<p class="empty-state">Your watchlist is empty. Explore stocks and add ones you want to follow.</p>';
}

let currentTicker = null;

function showView(viewId) {
    ["dashboard-view", "stock-directory-view", "stock-detail-view"].forEach(id => {
        document.getElementById(id).classList.toggle("hidden", id !== viewId);
    });
}

function showDashboard() {
    currentTicker = null;
    showView("dashboard-view");
    history.replaceState(null, "", location.pathname);
    renderStockWatchlist();
}

function showStockDirectory() {
    currentTicker = null;
    showView("stock-directory-view");
    history.replaceState(null, "", "#stocks");
    renderStockDirectory();
}

function showStockDetail(ticker) {
    if (!stocks[ticker]) return;
    currentTicker = ticker;
    showView("stock-detail-view");
    history.replaceState(null, "", `#stock/${ticker}`);
    renderStockDetail(ticker);
}

function renderStockDirectory() {
    const container = document.getElementById("stock-directory");
    if (!container) return;
    container.innerHTML = Object.entries(stocks).map(([ticker, stock]) => `
        <article class="directory-card">
            <div><strong>${ticker}</strong><span>${stock.name}</span></div>
            <div class="directory-price">$${stock.price.toFixed(2)} <small class="${stock.change >= 0 ? "up" : "down"}">${stock.change >= 0 ? "+" : ""}${(stock.change * 100).toFixed(2)}%</small></div>
            <button class="btn-primary" type="button" onclick="showStockDetail('${ticker}')">Watch stock</button>
        </article>`).join("");
}

function renderStockDetail(ticker) {
    const stock = stocks[ticker];
    const userData = getUserData();
    if (!stock || !userData) return;
    const container = document.getElementById("stock-detail");
    const quantityInput = container.querySelector("#detail-quantity");
    const quantity = quantityInput ? quantityInput.value : "1";
    const watching = (userData.watchlist || []).includes(ticker);
    const holding = userData.holdings[ticker]?.shares || 0;
    container.innerHTML = `
        <button class="text-button back-button" onclick="showStockDirectory()">← All stocks</button>
        <div class="detail-heading"><div><p class="eyebrow">${ticker}</p><h2>${stock.name}</h2></div><div class="detail-price"><strong>$${stock.price.toFixed(2)}</strong><span class="${stock.change >= 0 ? "up" : "down"}">${stock.change >= 0 ? "+" : ""}${(stock.change * 100).toFixed(2)}%</span></div></div>
        <canvas id="detail-chart" class="detail-chart" aria-label="${ticker} simulated stock price history" role="img"></canvas>
        <p class="holding-note">You own ${holding} shares.</p>
        <div class="detail-actions"><label for="detail-quantity">Shares</label><input id="detail-quantity" type="number" min="1" step="1" value="1"><button type="button" onclick="executeOrder('BUY','${ticker}','detail-quantity')" class="btn-buy">Buy</button><button type="button" onclick="executeOrder('SELL','${ticker}','detail-quantity')" class="btn-sell">Sell</button><button type="button" onclick="toggleWatch('${ticker}')" class="${watching ? "btn-watching" : "btn-watch"}">${watching ? "✓ Watching" : "＋ Watch"}</button></div>`;
    container.querySelector("#detail-quantity").value = quantity;
    drawStockChart("detail-chart", stock.history);
}

function toggleWatch(ticker) {
    if (!currentUser) return;
    const userData = getUserData();
    userData.watchlist = userData.watchlist || [];
    if (userData.watchlist.includes(ticker)) userData.watchlist = userData.watchlist.filter(item => item !== ticker);
    else userData.watchlist.push(ticker);
    saveUserData(userData);
    renderStockWatchlist();
    if (currentTicker === ticker) renderStockDetail(ticker);
}

function drawStockChart(canvasId, history) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || history.length < 1) return;

    const ctx = canvas.getContext("2d");
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const min = Math.min(...history);
    const max = Math.max(...history);
    const range = max - min || 1;
    const padding = 6;

    const points = history.map((price, index) => ({
        x: padding +
            (index / Math.max(history.length - 1, 1)) *
            (width - padding * 2),
        y: height - padding -
            ((price - min) / range) *
            (height - padding * 2)
    }));

    const rising = history[history.length - 1] >= history[0];

    ctx.strokeStyle = rising ? "#16a34a" : "#dc2626";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    ctx.beginPath();

    points.forEach((point, index) => {
        if (index === 0) {
            ctx.moveTo(point.x, point.y);
        } else {
            ctx.lineTo(point.x, point.y);
        }
    });

    ctx.stroke();

    const last = points[points.length - 1];

    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
    ctx.fill();
}

window.onload = function() {
    checkSession();
    initializeStockSelect();
    renderStockWatchlist();
    startMarketEngine();
};

window.addEventListener("resize", renderStockWatchlist);
