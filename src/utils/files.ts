export function readFileBase64(file: File): Promise<string> {
  if (file.size > 10 * 1024 * 1024)
    return Promise.reject(new Error("File exceeds 10 MiB"));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });
}
