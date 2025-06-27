/**
 * File Converters - Handles file format conversions
 * Provides utilities for converting between different file formats
 */
export class FileConverters {
    constructor() {
        this.supportedConversions = {
            'text/plain': ['json', 'csv', 'xml'],
            'application/json': ['csv', 'xml', 'txt'],
            'text/csv': ['json', 'xml', 'txt'],
            'application/xml': ['json', 'csv', 'txt']
        };
    }

    /**
     * Get supported conversion formats for a file type
     */
    getSupportedFormats(fileType) {
        return this.supportedConversions[fileType] || [];
    }

    /**
     * Convert JSON to CSV
     */
    jsonToCsv(jsonData) {
        try {
            const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            
            if (!Array.isArray(data) || data.length === 0) {
                throw new Error('JSON data must be a non-empty array');
            }

            const headers = Object.keys(data[0]);
            const csvRows = [headers.join(',')];
            
            for (const row of data) {
                const values = headers.map(header => {
                    const value = row[header];
                    return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
                });
                csvRows.push(values.join(','));
            }
            
            return csvRows.join('\n');
        } catch (error) {
            throw new Error(`JSON to CSV conversion failed: ${error.message}`);
        }
    }

    /**
     * Convert CSV to JSON
     */
    csvToJson(csvData) {
        try {
            const lines = csvData.trim().split('\n');
            if (lines.length < 2) {
                throw new Error('CSV must have at least a header and one data row');
            }

            const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
            const jsonData = [];

            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                const obj = {};
                
                headers.forEach((header, index) => {
                    obj[header] = values[index] || '';
                });
                
                jsonData.push(obj);
            }

            return JSON.stringify(jsonData, null, 2);
        } catch (error) {
            throw new Error(`CSV to JSON conversion failed: ${error.message}`);
        }
    }

    /**
     * Convert JSON to XML
     */
    jsonToXml(jsonData) {
        try {
            const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            
            const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>\n';
            const xmlContent = this.objectToXml(data, 'root');
            
            return xmlHeader + xmlContent;
        } catch (error) {
            throw new Error(`JSON to XML conversion failed: ${error.message}`);
        }
    }

    /**
     * Helper function to convert object to XML
     */
    objectToXml(obj, rootName = 'item') {
        if (typeof obj !== 'object' || obj === null) {
            return `<${rootName}>${this.escapeXml(String(obj))}</${rootName}>`;
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.objectToXml(item, rootName)).join('\n');
        }

        let xml = `<${rootName}>`;
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'object' && value !== null) {
                xml += `\n  ${this.objectToXml(value, key).replace(/\n/g, '\n  ')}`;
            } else {
                xml += `\n  <${key}>${this.escapeXml(String(value))}</${key}>`;
            }
        }
        xml += `\n</${rootName}>`;
        
        return xml;
    }

    /**
     * Escape XML special characters
     */
    escapeXml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Convert file to different format
     */
    async convertFile(fileContent, fromType, toType) {
        try {
            switch (`${fromType}:${toType}`) {
                case 'application/json:csv':
                    return this.jsonToCsv(fileContent);
                
                case 'text/csv:json':
                    return this.csvToJson(fileContent);
                
                case 'application/json:xml':
                    return this.jsonToXml(fileContent);
                
                default:
                    throw new Error(`Conversion from ${fromType} to ${toType} is not supported`);
            }
        } catch (error) {
            throw new Error(`File conversion failed: ${error.message}`);
        }
    }

    /**
     * Get conversion info
     */
    getConversionInfo() {
        return {
            supportedConversions: this.supportedConversions,
            description: 'Handles conversions between common file formats like JSON, CSV, and XML'
        };
    }
}

// Export singleton instance
export const fileConverters = new FileConverters();
export default FileConverters; 