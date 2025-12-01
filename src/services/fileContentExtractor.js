import * as pdfjsLib from 'pdfjs-dist/webpack'
import * as XLSX from 'xlsx'
import mammoth from 'mammoth'

// Configurar PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

class FileContentExtractor {
  /**
   * Extrae texto de un archivo según su tipo
   * @param {File} file - Archivo a procesar
   * @returns {Promise<string>} - Texto extraído del archivo
   */
  async extractContent(file) {
    const fileType = file.type.toLowerCase()
    const fileName = file.name.toLowerCase()
    
    try {
      if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
        return await this.extractFromPDF(file)
      } else if (
        fileType.includes('sheet') || 
        fileType.includes('excel') ||
        fileName.endsWith('.xlsx') ||
        fileName.endsWith('.xls')
      ) {
        return await this.extractFromExcel(file)
      } else if (
        fileType.includes('document') ||
        fileType.includes('word') ||
        fileName.endsWith('.docx') ||
        fileName.endsWith('.doc')
      ) {
        return await this.extractFromWord(file)
      } else {
        throw new Error(`Tipo de archivo no soportado: ${fileType}`)
      }
    } catch (error) {
      console.error('Error extracting content from file:', error)
      throw new Error(`Error extrayendo contenido: ${error.message}`)
    }
  }

  /**
   * Extrae texto de un archivo PDF
   * @param {File} file - Archivo PDF
   * @returns {Promise<string>} - Texto extraído
   */
  async extractFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    let fullText = ''

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()
      const pageText = textContent.items.map(item => item.str).join(' ')
      fullText += pageText + '\n'
    }

    return fullText.trim()
  }

  /**
   * Extrae texto de un archivo Excel
   * @param {File} file - Archivo Excel
   * @returns {Promise<string>} - Texto extraído
   */
  async extractFromExcel(file) {
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    let fullText = ''

    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName]
      const sheetText = XLSX.utils.sheet_to_txt(worksheet)
      fullText += `Hoja: ${sheetName}\n${sheetText}\n\n`
    })

    return fullText.trim()
  }

  /**
   * Extrae texto de un archivo Word
   * @param {File} file - Archivo Word
   * @returns {Promise<string>} - Texto extraído
   */
  async extractFromWord(file) {
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    return result.value.trim()
  }

  /**
   * Verifica si un archivo es soportado para extracción
   * @param {File} file - Archivo a verificar
   * @returns {boolean} - True si es soportado
   */
  isSupported(file) {
    const fileType = file.type.toLowerCase()
    const fileName = file.name.toLowerCase()
    
    const supportedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ]
    
    const supportedExtensions = ['.pdf', '.xlsx', '.xls', '.docx', '.doc']
    
    return supportedTypes.includes(fileType) || 
           supportedExtensions.some(ext => fileName.endsWith(ext))
  }
}

export default new FileContentExtractor()