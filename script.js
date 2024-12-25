// Database setup
const dbName = "pharmacyDailyData";
let db;

const request = indexedDB.open(dbName, 1);
request.onupgradeneeded = function (event) {
    db = event.target.result;
    if (!db.objectStoreNames.contains("dailyData")) {
        db.createObjectStore("dailyData", { keyPath: "date" });
    }
};
request.onsuccess = function (event) {
    db = event.target.result;
    loadDatabasePreview();
};
request.onerror = function () {
    console.error("Failed to open IndexedDB");
};

// Function to update subtotal and category summary
function updateSubtotal(categoryElement) {
    const subtotalElem = categoryElement.querySelector(".subtotal");
    const categoryId = categoryElement.dataset.category;
    let subtotal = 0;

    categoryElement.querySelectorAll(".entry-row").forEach(row => {
        const amountInput = row.querySelector('input[type="number"]');
        const amount = parseFloat(amountInput.value) || 0;
        subtotal += amount;
    });

    subtotalElem.textContent = subtotal.toFixed(2);
    const summaryElem = document.getElementById(`${categoryId}Summary`);
    if (summaryElem) {
        summaryElem.textContent = subtotal.toFixed(2);
    }

    updateGrandTotals();
}

// Update grand totals for Amount In, Amount Out, and Grand Total
function updateGrandTotals() {
    let totalIn = 0;
    let totalOut = 0;
    let grandTotal = 0;
    let counterCash = 0;

    document.querySelectorAll("#amountIn .subtotal").forEach(subtotalElem => {
        totalIn += parseFloat(subtotalElem.textContent) || 0;
    });

    document.querySelectorAll("#amountOut .subtotal").forEach(subtotalElem => {
        totalOut += parseFloat(subtotalElem.textContent) || 0;
    });

    document.querySelectorAll("#amountCounterCash .subtotal").forEach(subtotalElem => {
        counterCash += parseFloat(subtotalElem.textContent) || 0;
    });

    grandTotal = totalIn - totalOut;

    document.querySelector("#totalIn").textContent = totalIn.toFixed(2);
    document.querySelector("#totalOut").textContent = totalOut.toFixed(2);
    document.querySelector("#counterCash").textContent = counterCash.toFixed(2);

    document.getElementById("totalInSummary").textContent = totalIn.toFixed(2);
    document.getElementById("totalOutSummary").textContent = totalOut.toFixed(2);
    document.getElementById("totalGrandSummary").textContent = grandTotal.toFixed(2);
    document.getElementById("counterCashSummary").textContent = counterCash.toFixed(2);
    document.getElementById("balanceSummary").textContent = (counterCash - grandTotal).toFixed(2);

    // if balance is negative, change color to red else green (if red then append text to sibling(the td on the right side of #balanceSummary) td existing content "(Deficit)" else "(Excess)" so final result will be like in case of deficit: <tr><td>Balance(Deficit)</td><td id="balanceSummary">0.00</td><td></tr>)
    const balanceSummary = document.getElementById("balanceSummary");
    const balanceSummarySibling = balanceSummary.previousElementSibling;
    if (balanceSummary.textContent < 0) {
        balanceSummarySibling.textContent = "Balance (Deficit)";
        balanceSummary.style.color = "red";
    } else if (balanceSummary.textContent > 0) {
        balanceSummarySibling.textContent = "Balance (Excess)";
        balanceSummary.style.color = "green";
    } else {
        balanceSummarySibling.textContent = "Balance";
        balanceSummary.style.color = "black";
    }
}

// Add event listeners for each category
function initializeCategory(categoryElement) {
    const addRowBtn = categoryElement.querySelector(".add-row-btn");

    addRowBtn.addEventListener("click", () => {
        const newRow = document.createElement("div");
        newRow.className = "entry-row";
        newRow.innerHTML = `
            <input type="text" placeholder="Description">
            <input type="number" placeholder="Amount" step="0.01">
            <button class="delete-row">-</button>
        `;

        categoryElement.insertBefore(newRow, addRowBtn);

        newRow.querySelector(".delete-row").addEventListener("click", () => {
            newRow.remove();
            updateSubtotal(categoryElement);
        });

        newRow.querySelector('input[type="number"]').addEventListener("input", () => {
            updateSubtotal(categoryElement);
        });
    });

    categoryElement.querySelectorAll(".entry-row").forEach(row => {
        row.querySelector('input[type="number"]').addEventListener("input", () => {
            updateSubtotal(categoryElement);
        });

        row.querySelector(".delete-row").addEventListener("click", () => {
            row.remove();
            updateSubtotal(categoryElement);
        });
    });
}

// Initialize all categories
function initializeCategories() {
    document.querySelectorAll(".category").forEach(categoryElement => {
        initializeCategory(categoryElement);
    });
}

// Save data to IndexedDB
function saveData() {
    const dateInput = document.getElementById("datetime");
    const currentDate = new Date().toISOString().slice(0, 16);
    dateInput.value = currentDate;

    const entries = [];

    document.querySelectorAll(".category").forEach(categoryElement => {
        const categoryId = categoryElement.dataset.category;

        categoryElement.querySelectorAll(".entry-row").forEach(row => {
            var description = row.querySelector('input[type="text"]').value.trim();
            const amount = parseFloat(row.querySelector('input[type="number"]').value) || 0;
            if (!description) {
                description = "N/A";
            }
            if (description && amount) {
                entries.push({
                    category: categoryId,
                    description,
                    amount
                });
            }
        });
    });

    const transaction = db.transaction("dailyData", "readwrite");
    const store = transaction.objectStore("dailyData");

    store.put({
        date: currentDate,
        entries
    });

    transaction.oncomplete = function () {
        loadDatabasePreview();
        alert("Data saved successfully.");
    };

    transaction.onerror = function () {
        console.error("Failed to save data.");
    };
}

document.getElementById("saveData").addEventListener("click", saveData);

// Load database preview
function loadDatabasePreview() {
    const transaction = db.transaction("dailyData", "readonly");
    const store = transaction.objectStore("dailyData");
    const request = store.getAll();

    request.onsuccess = function () {
        const tbody = document.querySelector("#databasePreview tbody");
        tbody.innerHTML = "";
        let openingBalance = 0;

        request.result.forEach(record => {
            let amountIn = 0;
            let amountOut = 0;

            record.entries.forEach(entry => {
                if (["manualSale", "systemSale", "pos", "easypaisa"].includes(entry.category)) {
                    amountIn += entry.amount;
                } else {
                    amountOut += entry.amount;
                }
            });

            const closingBalance = openingBalance + amountIn - amountOut;

            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${record.date}</td>
                <td>${openingBalance.toFixed(2)}</td>
                <td>${amountIn.toFixed(2)}</td>
                <td>${amountOut.toFixed(2)}</td>
                <td>${closingBalance.toFixed(2)}</td>
            `;

            tbody.appendChild(row);
            openingBalance = closingBalance;
        });
    };
}


function realtime(){
  var now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById('datetime').value = now.toISOString().slice(0,16);
}

// Initialize everything on page load
document.addEventListener("DOMContentLoaded", () => {
    realtime();
    setInterval(realtime, 1000);
    initializeCategories();
});
