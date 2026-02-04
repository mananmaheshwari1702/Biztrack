import * as XLSX from 'xlsx';
import { parse, isValid } from 'date-fns';
import type { Client, ClientType, ClientStatus } from '../types';

// ==========================================
// EXPORTS
// ==========================================

export const exportToExcel = (data: Record<string, unknown>[], fileName: string) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const exportClientsToExcel = (clients: Client[]) => {
    // 1. Sort by Next Call Date
    const sortedClients = [...clients].sort((a, b) => {
        const dateA = new Date(a.nextFollowUpDate || 0).getTime();
        const dateB = new Date(b.nextFollowUpDate || 0).getTime();
        return dateA - dateB;
    });

    // 2. Map Data
    const data = sortedClients.map(client => ({
        'Client ID': client.id || '',
        'Client Name': client.clientName || '',
        'Contact Number': client.mobile ? String(client.mobile) : '',
        'Email': client.email || '',
        'Type': client.clientType || '',
        'Status': client.status || '',
        'Next Call Date': formatDate(client.nextFollowUpDate),
        'Follow-up Frequency': client.frequency || '',
        'Notes': client.notes || '',
        'Created At': formatDate(client.createdAt)
    }));

    // 3. Create Sheet
    const worksheet = XLSX.utils.json_to_sheet(data);

    // 4. Create Workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'All Clients Database');

    // 5. Generate Filename: BizTrack_AllClients_YYYY-MM-DD.xlsx
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const fileName = `BizTrack_AllClients_${yyyy}-${mm}-${dd}.xlsx`;

    XLSX.writeFile(workbook, fileName);
};

// Kept for backward compatibility if needed, but logic is improved in parsePhoneNumber
export const normalizeMobile = (mobile: string | number): string => {
    if (!mobile) return '';
    return String(mobile).replace(/\D/g, '');
};

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    client: Client;
    isDuplicate: boolean;
    duplicateOfId?: string;
}

// ==========================================
// IMPORT LOGIC
// ==========================================

export const parseExcel = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];

                // 1. Convert to array of arrays first to detect header row
                const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

                // 2. Detect Header Row
                let headerRowIndex = 0;
                let foundHeader = false;

                // Synonyms for detection (normalized)
                const requiredName = ['name', 'fullname', 'clientname'];
                const requiredMobile = ['primaryphone', 'phone', 'mobile', 'contact', 'contactnumber'];

                // Scan first 20 rows
                for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
                    const row = rawRows[i];
                    if (!Array.isArray(row)) continue;

                    // Normalize row cells
                    const rowValues = row.map(val => String(val || '').toLowerCase().replace(/[^a-z0-9]/g, ''));

                    const hasName = rowValues.some(val => requiredName.includes(val));
                    const hasMobile = rowValues.some(val => requiredMobile.includes(val));

                    if (hasName && hasMobile) {
                        headerRowIndex = i;
                        foundHeader = true;
                        break;
                    }
                }

                // 3. Parse with correct header row
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: foundHeader ? headerRowIndex : 0 });
                resolve(jsonData);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = (error) => reject(error);
        reader.readAsBinaryString(file);
    });
};

export const validateClientRow = (row: Record<string, unknown>, existingClients: Client[] = []): ValidationResult => {
    const errors: string[] = [];
    let isDuplicate = false;
    let duplicateOfId: string | undefined = undefined;

    // -- 1. Value Extraction --
    const getName = () => findValue(row, ['clientname', 'fullname', 'name']);
    const getMobile = () => findValue(row, ['mobile', 'primaryphone', 'phone', 'contact', 'contactnumber', 'phoneno']);
    const getEmail = () => findValue(row, ['email', 'emailaddress']);
    const getType = () => findValue(row, ['clienttype', 'type', 'category', 'role']);
    const getStatus = () => findValue(row, ['status', 'state', 'currentstatus']);
    const getFreq = () => findValue(row, ['frequency', 'followupfrequency', 'recurrence']);
    const getDate = () => findValue(row, ['nextfollowupdate', 'nextcall', 'nextcalldate', 'calldate', 'followup', 'followupdate']);
    const getNotes = () => findValue(row, ['notes', 'note', 'remark', 'remarks', 'description', 'comment']);
    const getCreatedAt = () => findValue(row, ['createdat', 'createdon', 'dateadded']);
    const getId = () => findValue(row, ['id', 'clientid']);

    const clientName = getName();
    const rawMobile = getMobile();
    const rawEmail = getEmail();
    const rawDate = getDate();

    // -- 2. Required Field Checks --
    if (!clientName) errors.push('Missing Client Name');
    if (!rawMobile) errors.push('Missing Mobile Number');

    // -- 3. Mobile Processing --
    const { mobile, countryCode, isValid: isMobileValid } = parsePhoneNumber(rawMobile);

    if (rawMobile && !isMobileValid) {
        errors.push('Invalid Mobile Number (must be at least 10 digits)');
    }

    // -- 4. Duplicate Check --
    if (isMobileValid && mobile) {
        // Compare with existing client mobiles (normalized to effective 10-digit number)
        const existing = existingClients.find(c => {
            const { mobile: existingMobile } = parsePhoneNumber(c.mobile);
            return existingMobile === mobile;
        });

        if (existing) {
            isDuplicate = true;
            duplicateOfId = existing.id;
        }
    }

    // -- 5. Date processing --
    let finalNextDate = new Date().toISOString();
    if (rawDate) {
        const parsed = parseFlexibleDate(rawDate);
        if (parsed) {
            finalNextDate = parsed;
        } else {
            errors.push('Invalid Date Format. Use MM/DD/YYYY');
        }
    }

    // -- 6. Construct Client --
    const client: Client = {
        id: (getId() ? String(getId()) : (duplicateOfId || crypto.randomUUID())),
        clientName: clientName ? String(clientName).trim() : '',
        mobile: mobile,
        countryCode: countryCode,
        email: rawEmail ? String(rawEmail).trim() : '',
        clientType: (getType() ? String(getType()) : 'Prospect') as ClientType,
        status: (getStatus() ? String(getStatus()) : 'Active') as ClientStatus,
        frequency: (getFreq() ? String(getFreq()) : 'Monthly') as Client['frequency'],
        nextFollowUpDate: finalNextDate,
        notes: getNotes() ? String(getNotes()) : '',
        createdAt: getCreatedAt() ? String(getCreatedAt()) : new Date().toISOString(),
    };

    return {
        isValid: errors.length === 0,
        errors,
        client,
        isDuplicate,
        duplicateOfId
    };
};

// ==========================================
// HELPERS
// ==========================================

const findValue = (row: Record<string, unknown>, targetKeys: string[]): unknown => {
    // Normalize row keys once
    const normalizedRowKeys = Object.keys(row).reduce((acc, key) => {
        const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
        acc[normalized] = key;
        return acc;
    }, {} as Record<string, string>);

    for (const target of targetKeys) {
        // Target keys are already normalized in the caller
        if (normalizedRowKeys[target]) {
            return row[normalizedRowKeys[target]];
        }
    }
    return undefined;
};

const parsePhoneNumber = (raw: unknown): { mobile: string, countryCode: string, isValid: boolean } => {
    const str = String(raw || '').replace(/\D/g, ''); // Remove non-digits

    if (str.length < 10) {
        return { mobile: str, countryCode: '+91', isValid: false };
    }

    let countryCode = '+91';
    let mobile = str;

    if (str.length === 12 && str.startsWith('91')) {
        // Case: 919876543210 -> +91, 9876543210
        countryCode = '+91';
        mobile = str.substring(2);
    } else if (str.length === 10) {
        // Case: 9876543210 -> +91, 9876543210
        countryCode = '+91';
        mobile = str;
    } else if (str.length > 10) {
        // Case: Variable length prefix
        const splitIndex = str.length - 10;
        const prefix = str.substring(0, splitIndex);

        if (prefix.length > 4) {
            // Fallback: Prefix too long, assume it's part of number or invalid format, 
            // but user rule says "fallback to +91"
            countryCode = '+91';
            mobile = str.substring(splitIndex);
        } else {
            countryCode = '+' + prefix;
            mobile = str.substring(splitIndex);
        }
    }

    return { mobile, countryCode, isValid: true };
};

const formatDate = (dateVal: any): string => {
    if (!dateVal) return '';
    let date: Date;
    if (typeof dateVal === 'object' && dateVal && typeof dateVal.toDate === 'function') {
        date = dateVal.toDate();
    } else {
        date = new Date(dateVal);
    }

    if (isNaN(date.getTime())) return '';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

const parseFlexibleDate = (value: any): string | null => {
    if (!value) return null;
    if (typeof value === 'number') {
        const date = new Date(Math.round((value - 25569) * 86400 * 1000));
        return !isNaN(date.getTime()) ? date.toISOString() : null;
    }

    const str = String(value).trim();
    if (!str) return null;

    const formatsToTry = ['MM/dd/yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd', 'dd-MM-yyyy', 'MM-dd-yyyy'];

    for (const fmt of formatsToTry) {
        const d = parse(str, fmt, new Date());
        if (isValid(d) && d.getFullYear() > 1900 && d.getFullYear() < 2100) {
            return d.toISOString();
        }
    }

    const jsDate = new Date(str);
    if (!isNaN(jsDate.getTime()) && jsDate.getFullYear() > 1900) {
        return jsDate.toISOString();
    }

    return null;
};
