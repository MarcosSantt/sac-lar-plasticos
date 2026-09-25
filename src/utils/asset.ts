/** Caminho de arquivos de public/ respeitando o base do Vite (GitHub Pages). */
export const asset = (file: string) => `${import.meta.env.BASE_URL}${file}`
