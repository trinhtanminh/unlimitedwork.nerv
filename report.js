// Configuration for expected column names in Excel/CSV files.
const COLUMN_CONFIG = {
    LABEL: ['Nhãn tùy chỉnh'],
    POST_DATE: ['Thời gian đăng'],
    PAGE_NAME: ['Tên Trang'],
    DAILY_DATE: ['Ngày'],
    VIEWS_3S: ['Lượt xem video trong tối thiểu 3 giây'],
    EARNINGS: [
        'Thu nhập ước tính khi tham gia chương trình kiếm tiền từ nội dung',
        'Thu nhập ước tính ((USD))'
    ]
};

// Extend dayjs with the CustomParseFormat plugin to handle various date formats.
dayjs.extend(window.dayjs_plugin_customParseFormat);

// Global state for the report tool
let pageDataSets = {};
let pageCounter = 0;
let summaryDataForExport = [];
let isReportInitialized = false;

/**
 * Finds the first matching column name from a list of aliases.
 * @param {object} headerRow - The first row of the data, representing headers.
 * @param {string[]} aliases - A list of possible names for the column.
 * @returns {string|null} The found column name or null.
 */
function findColumnName(headerRow, aliases) {
    for (const alias of aliases) {
        if (headerRow.hasOwnProperty(alias)) return alias;
    }
    return null;
}

/**
 * Creates the HTML structure for a new page upload block.
 * @param {string} id - A unique identifier for the page block.
 * @returns {HTMLElement} The created page block element.
 */
function createPageBlock(id) {
    pageCounter++;
    const pageBlock = document.createElement('div');
    pageBlock.className = 'glass-pane !p-4 !rounded-xl page-block';
    pageBlock.dataset.pageId = id;

    pageBlock.innerHTML = `
        <div class="flex justify-between items-center mb-3">
             <h3 class="text-base font-bold text-gray-800">Page ${pageCounter}</h3>
             <button class="remove-page-btn text-gray-400 hover:text-red-500 text-xl leading-none">&times;</button>
        </div>
        <div class="space-y-3">
            <!-- Post Count File Upload -->
            <div class="upload-area" data-type="post" data-id="${id}">
                <input type="file" class="hidden" accept=".csv, .xlsx, .xls">
                <div class="flex items-center gap-3">
                    <div class="upload-icon flex-shrink-0 w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center text-gray-500">
                        <i class="fas fa-file-alt"></i>
                    </div>
                    <div class="flex-grow overflow-hidden">
                        <p class="upload-title text-sm font-semibold text-gray-700">Báo cáo Số bài đăng</p>
                        <p class="upload-status text-xs text-gray-500 truncate">Chọn hoặc kéo thả tệp...</p>
                    </div>
                </div>
            </div>
            <!-- Revenue File Upload -->
            <div class="upload-area" data-type="revenue" data-id="${id}">
                <input type="file" class="hidden" accept=".csv, .xlsx, .xls">
                <div class="flex items-center gap-3">
                    <div class="upload-icon flex-shrink-0 w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center text-gray-500">
                        <i class="fas fa-file-invoice-dollar"></i>
                    </div>
                    <div class="flex-grow overflow-hidden">
                        <p class="upload-title text-sm font-semibold text-gray-700">Báo cáo Doanh thu</p>
                        <p class="upload-status text-xs text-gray-500 truncate">Chọn hoặc kéo thả tệp...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    return pageBlock;
}

/**
 * Sets up event listeners for a file upload area (click, drag-drop).
 * @param {HTMLElement} uploadArea - The element representing the upload zone.
 */
function setupUploadArea(uploadArea) {
    const fileInput = uploadArea.querySelector('input[type="file"]');
    
    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('!bg-blue-50', '!border-blue-400'); });
    uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('!bg-blue-50', '!border-blue-400'));
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('!bg-blue-50', '!border-blue-400');
        if (e.dataTransfer.files.length > 0) {
            fileInput.files = e.dataTransfer.files;
            handleFile(fileInput.files[0], uploadArea);
        }
    });
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) handleFile(fileInput.files[0], uploadArea);
    });
}

/**
 * Handles the file reading and parsing process.
 * @param {File} file - The file to be processed.
 * @param {HTMLElement} uploadArea - The corresponding upload area element.
 */
function handleFile(file, uploadArea) {
    const { id, type } = uploadArea.dataset;
    const statusEl = uploadArea.querySelector('.upload-status');
    const iconEl = uploadArea.querySelector('.upload-icon');
    const errorMessage = document.getElementById('error-message');

    statusEl.textContent = `Đang đọc: ${file.name}`;
    iconEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
    errorMessage.textContent = '';

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const workbook = XLSX.read(e.target.result, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false });
            
            if (type === 'post') pageDataSets[id].postFile = jsonData;
            else pageDataSets[id].revenueFile = jsonData;

            statusEl.textContent = `✓ ${file.name}`;
            statusEl.classList.add('!text-green-600', 'font-semibold');
            iconEl.innerHTML = `<i class="fas fa-check-circle text-green-500"></i>`;

        } catch (err) {
            console.error("File reading error:", err);
            statusEl.textContent = `✗ Lỗi đọc tệp`;
            statusEl.classList.add('!text-red-600', 'font-semibold');
            iconEl.innerHTML = `<i class="fas fa-times-circle text-red-500"></i>`;
            errorMessage.textContent = 'Định dạng tệp không hợp lệ hoặc tệp bị lỗi.';
        }
    };
    reader.readAsBinaryString(file);
}

/**
 * Adds a new page upload block to the UI.
 * @param {HTMLElement} container - The container to add the block to.
 */
function addNewPage(container) {
    if (!container) return;

    const id = Date.now();
    pageDataSets[id] = { postFile: null, revenueFile: null, pageName: `Page ${pageCounter + 1}` };
    const newBlock = createPageBlock(id);
    container.appendChild(newBlock);
    newBlock.querySelectorAll('.upload-area').forEach(setupUploadArea);
}

/**
 * Processes a single data file (either post count or revenue).
 * @param {object[]} data - The array of data from the parsed file.
 * @param {string} start - The start date for filtering.
 * @param {string} end - The end date for filtering.
 * @param {object} combinedData - The object to aggregate results into.
 * @param {string} type - The type of file ('postCount' or 'revenue').
 * @param {string} pageName - The name of the page this file belongs to.
 */
function processFile(data, start, end, combinedData, type, pageName) {
    if (!data || data.length === 0) {
        console.warn(`Một tệp ${type} cho ${pageName} rỗng hoặc không hợp lệ đã bị bỏ qua.`);
        return;
    }
    const headerRow = data[0];
    const startDate = dayjs(start);
    const endDate = dayjs(end);
    const isPostFile = type === 'postCount';

    const colLabel = findColumnName(headerRow, COLUMN_CONFIG.LABEL);
    const colPageName = findColumnName(headerRow, COLUMN_CONFIG.PAGE_NAME);
    const colPostDate = isPostFile ? findColumnName(headerRow, COLUMN_CONFIG.POST_DATE) : null;
    const colDailyDate = !isPostFile ? findColumnName(headerRow, COLUMN_CONFIG.DAILY_DATE) : null;
    const colViews3s = !isPostFile ? findColumnName(headerRow, COLUMN_CONFIG.VIEWS_3S) : null;
    const colEarnings = !isPostFile ? findColumnName(headerRow, COLUMN_CONFIG.EARNINGS) : null;

    const requiredColsFound = isPostFile ?
        (colLabel && colPostDate && colPageName) :
        (colLabel && colDailyDate && colViews3s && colPageName);

    if (!requiredColsFound) {
         const missing = [];
         if (!colLabel) missing.push(`'${COLUMN_CONFIG.LABEL[0]}'`);
         if (!colPageName) missing.push(`'${COLUMN_CONFIG.PAGE_NAME[0]}'`);
         if (isPostFile && !colPostDate) missing.push(`'${COLUMN_CONFIG.POST_DATE[0]}'`);
         if (!isPostFile && !colDailyDate) missing.push(`'${COLUMN_CONFIG.DAILY_DATE[0]}'`);
         if (!isPostFile && !colViews3s) missing.push(`'${COLUMN_CONFIG.VIEWS_3S[0]}'`);
        throw new Error(`Tệp cho ${pageName} thiếu cột: ${missing.join(', ')}`);
    }
    
    data.forEach(row => {
        const dateStr = String(row[isPostFile ? colPostDate : colDailyDate] || '');
        const rowDate = dayjs(dateStr.split(' ')[0], ["MM/DD/YYYY", "M/D/YY", "YYYY-MM-DD", "M/D/YYYY"], true);

        if (rowDate.isValid() && rowDate.isAfter(startDate.subtract(1, 'day')) && rowDate.isBefore(endDate.add(1, 'day'))) {
            const originalLabel = row[colLabel] || "Không có nhãn";
            const partnerName = (originalLabel.split('_').find(p => p.startsWith('PN')) || 'Không xác định').trim();
            const pageNameFromData = (row[colPageName] || originalLabel.split('_')[1] || 'Không xác định').trim();

            if (!combinedData[partnerName]) {
                combinedData[partnerName] = { partnerName, pages: {}, totalPosts: 0, totalViews: 0, totalUsd: 0 };
            }
            if (!combinedData[partnerName].pages[pageNameFromData]) {
                combinedData[partnerName].pages[pageNameFromData] = { pageName: pageNameFromData, postCount: 0, views: 0, usd: 0 };
            }

            const pageData = combinedData[partnerName].pages[pageNameFromData];
            if (isPostFile) {
                pageData.postCount += 1;
            } else {
                pageData.views += Number(row[colViews3s]) || 0;
                if (colEarnings) {
                    const earningsValue = String(row[colEarnings] || '0').replace(/[^0-9.-]+/g, "");
                    pageData.usd += Number(earningsValue) || 0;
                }
            }
        }
    });
}

/**
 * Renders the main results table.
 * @param {object[]} data - The processed and sorted report data.
 * @param {string} start - The start date of the report.
 * @param {string} end - The end date of the report.
 */
function renderResultTable(data, start, end) {
    const resultTable = document.getElementById('result-table');
    const reportTitle = document.getElementById('report-title');
    const startFormatted = dayjs(start).format('DD/M');
    const endFormatted = dayjs(end).format('DD/M');
    reportTitle.textContent = `BÁO CÁO SỐ WEEKLY TUẦN ${startFormatted} - ${endFormatted}`;

    // The new CSS handles the styling for thead, so we can simplify the classes here.
    let tableHTML = `
        <thead>
            <tr>
                <th rowspan="2">STT</th>
                <th class="text-left" rowspan="2">Đối tác</th>
                <th class="text-left" rowspan="2">Page</th>
                <th rowspan="2">Số video</th>
                <th rowspan="2">Total view</th>
                <th rowspan="2">USD</th>
                <th colspan="2">Tổng</th>
            </tr>
            <tr>
                <th>Tổng số video</th>
                <th>Tổng số view</th>
            </tr>
        </thead>
        <tbody>
    `;
    
    let grandTotalPosts = 0, grandTotalViews = 0, grandTotalUsd = 0;

    data.forEach((partnerData, index) => {
        grandTotalPosts += partnerData.totalPosts;
        grandTotalViews += partnerData.totalViews;
        grandTotalUsd += partnerData.totalUsd;
        
        const pages = Object.values(partnerData.pages).sort((a,b) => b.usd - a.usd);
        const rowSpan = pages.length > 0 ? `rowspan="${pages.length}"` : '';

        pages.forEach((page, pageIndex) => {
            tableHTML += `<tr>`;
            if (pageIndex === 0) {
                tableHTML += `
                    <td class="text-center align-top" ${rowSpan}>${index + 1}</td>
                    <td class="align-top" ${rowSpan}>${partnerData.partnerName}</td>
                `;
            }
            tableHTML += `
                <td>${page.pageName}</td>
                <td class="video-count-value text-center">${page.postCount.toLocaleString('en-US')}</td>
                <td class="text-right">${page.views.toLocaleString('en-US')}</td>
                <td class="usd-value text-right">$${page.usd.toFixed(2)}</td>
            `;
            if (pageIndex === 0) {
                tableHTML += `
                    <td class="video-count-value font-bold text-center align-middle" ${rowSpan}>${partnerData.totalPosts.toLocaleString('en-US')}</td>
                    <td class="total-view-value font-bold text-center align-middle" ${rowSpan}>${partnerData.totalViews.toLocaleString('en-US')}</td>
                `;
            }
            tableHTML += `</tr>`;
        });
    });

    tableHTML += `
        </tbody>
        <tfoot>
            <tr class="font-bold">
                <td class="text-right" colspan="3">TỔNG CỘNG</td>
                <td class="video-count-value text-center">${grandTotalPosts.toLocaleString('en-US')}</td>
                <td class="text-right">${grandTotalViews.toLocaleString('en-US')}</td>
                <td class="usd-value text-right">$${grandTotalUsd.toFixed(2)}</td>
                <td colspan="2"></td>
            </tr>
        </tfoot>
    `;
    resultTable.innerHTML = tableHTML;
}

/**
 * Renders the summary table.
 * @param {object[]} data - The data for the summary table.
 */
function renderSummaryTable(data) {
    const summaryTable = document.getElementById('summary-table');
    // The new CSS handles the styling for thead, so I can simplify the classes here.
    let tableHTML = `
        <thead>
            <tr>
                <th>STT</th>
                <th class="text-left">Đối Tác</th>
                <th>Video</th>
                <th>Views</th>
            </tr>
        </thead>
        <tbody>
    `;
    data.forEach(row => {
        tableHTML += `
            <tr>
                <td class="text-center">${row.STT}</td>
                <td>${row['Đối Tác']}</td>
                <td class="video-count-value text-center">${row.Video.toLocaleString('en-US')}</td>
                <td class="total-view-value text-right">${row.Views.toLocaleString('en-US')}</td>
            </tr>
        `;
    });
    tableHTML += '</tbody>';
    summaryTable.innerHTML = tableHTML;
}

/**
 * Processes and renders the summary section.
 * @param {object[]} reportData - The main report data.
 */
function processAndRenderSummary(reportData) {
    const summaryTableContainer = document.getElementById('summary-table-container');
    const filteredData = reportData.filter(partner => partner.totalPosts > 0);
    if (filteredData.length === 0) {
        summaryTableContainer.classList.add('hidden');
        return;
    }
    summaryTableContainer.classList.remove('hidden');
    const sortedData = filteredData.sort((a, b) => b.totalViews - a.totalViews);
    summaryDataForExport = sortedData.map((partner, index) => ({
        'STT': index + 1,
        'Đối Tác': partner.partnerName,
        'Video': partner.totalPosts,
        'Views': partner.totalViews
    }));
    renderSummaryTable(summaryDataForExport);
}

/**
 * Exports the summary data to an Excel file.
 */
function exportSummaryToExcel() {
     if (summaryDataForExport.length === 0) {
        alert("Không có dữ liệu tổng kết để xuất file.");
        return;
    }
    const ws = XLSX.utils.json_to_sheet(summaryDataForExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Báo cáo tổng kết");
    XLSX.writeFile(wb, "Bao_cao_tong_ket.xlsx");
}

/**
 * Exports the weekly report data to an Excel file.
 */
function exportWeeklyReportToExcel() {
    const table = document.getElementById('result-table');
    if (!table) {
        alert("Không tìm thấy bảng báo cáo.");
        return;
    }
    const wb = XLSX.utils.table_to_book(table, { sheet: "Báo cáo tuần" });
    XLSX.writeFile(wb, "Bao_cao_tuan.xlsx");
}

/**
 * Main function to generate the report.
 */
async function generateReport() {
    // Use elements from the modal
    const startDateInput = document.getElementById('report-start-date');
    const endDateInput = document.getElementById('report-end-date');
    // Note: We can add an error message element inside the modal if needed
    const errorMessage = document.getElementById('error-message'); // This is the old one, might need a new one for the modal
    const allReportsContainer = document.getElementById('all-reports-container');
    const noReportPlaceholder = document.getElementById('no-report-placeholder');
    const processButton = document.getElementById('process-report-button');
    // We can add a loader to the modal button as well
    // const loader = document.getElementById('loader'); 
    // const buttonText = document.getElementById('button-text');

    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    const validDataSets = Object.entries(pageDataSets).filter(([_, ds]) => ds && ds.postFile && ds.revenueFile);

    if (!startDate || !endDate || validDataSets.length === 0) {
        errorMessage.textContent = 'Vui lòng chọn ngày và tải lên đủ 2 tệp cho ít nhất một Page.';
        return;
    }
    errorMessage.textContent = ''; // Clear main page error
    processButton.disabled = true;
    processButton.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Đang xử lý...`;
    allReportsContainer.classList.add('hidden');
    allReportsContainer.classList.remove('flex');
    noReportPlaceholder.classList.add('hidden');


    await new Promise(resolve => setTimeout(resolve, 50));

    try {
        const combinedData = {};
        for (const [id, dataSet] of validDataSets) {
            processFile(dataSet.postFile, startDate, endDate, combinedData, 'postCount', dataSet.pageName);
            processFile(dataSet.revenueFile, startDate, endDate, combinedData, 'revenue', dataSet.pageName);
        }

        for (const partner in combinedData) {
            let totalPosts = 0, totalViews = 0, totalUsd = 0;
            for (const page in combinedData[partner].pages) {
                totalPosts += combinedData[partner].pages[page].postCount;
                totalViews += combinedData[partner].pages[page].views;
                totalUsd += combinedData[partner].pages[page].usd;
            }
            combinedData[partner].totalPosts = totalPosts;
            combinedData[partner].totalViews = totalViews;
            combinedData[partner].totalUsd = totalUsd;
        }

        const reportData = Object.values(combinedData).sort((a, b) => b.totalUsd - a.totalUsd);
        renderResultTable(reportData, startDate, endDate);
        processAndRenderSummary(reportData);
        allReportsContainer.classList.remove('hidden');
        allReportsContainer.classList.add('flex'); // Use flex to show it correctly
        noReportPlaceholder.classList.add('hidden');
        closeModal('report-creation-modal'); // Close modal on success

    } catch (error) {
        console.error(error);
        errorMessage.textContent = `Lỗi: ${error.message}`; // Show error on main page
        noReportPlaceholder.classList.remove('hidden');
    } finally {
        processButton.disabled = false;
        processButton.innerHTML = 'Xử lý và Tạo Báo Cáo';
    }
}

/**
 * Initializes modal-specific event listeners.
 */
function initializeModalEventListeners() {
    const createReportBtn = document.getElementById('create-report-btn');
    const addReportPageButton = document.getElementById('add-report-page-button');
    const processReportButton = document.getElementById('process-report-button');
    const reportUploadContainer = document.getElementById('report-upload-container');

    if (createReportBtn) {
        createReportBtn.addEventListener('click', () => {
            // Reset modal state
            pageDataSets = {};
            pageCounter = 0;
            reportUploadContainer.innerHTML = '';
            addNewPage(reportUploadContainer); // Add the first page block
            document.getElementById('report-start-date').value = '';
            document.getElementById('report-end-date').value = '';
            openModal('report-creation-modal');
        });
    }

    if (addReportPageButton) {
        addReportPageButton.addEventListener('click', () => addNewPage(reportUploadContainer));
    }

    if (processReportButton) {
        processReportButton.addEventListener('click', generateReport);
    }

    if (reportUploadContainer) {
        reportUploadContainer.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('.remove-page-btn');
            if (removeBtn) {
                const pageBlock = removeBtn.closest('.page-block');
                if (pageBlock) {
                    const id = pageBlock.dataset.pageId;
                    delete pageDataSets[id];
                    pageBlock.remove();
                    
                    // Re-number the remaining page headers
                    const remainingBlocks = reportUploadContainer.querySelectorAll('.page-block');
                    pageCounter = 0;
                    remainingBlocks.forEach(block => {
                        pageCounter++;
                        block.querySelector('h3').textContent = `Page ${pageCounter}`;
                    });
                }
            }
        });
    }
}


/**
 * Initializes all event listeners for the report tool.
 */
function initializeEventListeners() {
    const exportSummaryButton = document.getElementById('export-summary-button');
    if (exportSummaryButton) {
        exportSummaryButton.addEventListener('click', exportSummaryToExcel);
    }

    const exportWeeklyReportButton = document.getElementById('export-weekly-report-btn');
    if (exportWeeklyReportButton) {
        exportWeeklyReportButton.addEventListener('click', exportWeeklyReportToExcel);
    }
    
    // Add a placeholder for the error message if it doesn't exist, to prevent errors
    if (!document.getElementById('error-message')) {
        const p = document.createElement('p');
        p.id = 'error-message';
        p.className = 'hidden';
        document.body.appendChild(p);
    }
}

/**
 * Sets up the initial state of the report tool UI.
 */
function setupInitialUI() {
    // No longer needed as the modal handles the initial block
}

/**
 * Main initialization function for the report tool.
 */
function initializeReportTool() {
    if (isReportInitialized) return;

    // setupInitialUI(); // Deprecated
    initializeEventListeners();
    initializeModalEventListeners(); // Initialize new modal listeners
    
    isReportInitialized = true;
}

// Use a MutationObserver to initialize the tool when the container becomes visible.
// This approach is robust and avoids re-initialization or state loss.
const reportContainer = document.getElementById('facebook-mcv-report-content');
if (reportContainer) {
    const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const isHidden = reportContainer.classList.contains('hidden');
                if (!isHidden) {
                    initializeReportTool();
                }
            }
        }
    });

    observer.observe(reportContainer, { attributes: true });
}
