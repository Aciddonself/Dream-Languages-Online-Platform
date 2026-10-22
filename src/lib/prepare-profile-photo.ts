const maxPhotoBytes = 5 * 1024 * 1024;
const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function prepareProfilePhoto(file: File) {
  if (!supportedTypes.has(file.type) || file.size < 1 || file.size > maxPhotoBytes) {
    throw new Error("Choose a JPG, PNG, or WebP photo no larger than 5 MB.");
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Your browser could not prepare the profile photo.");
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const jpeg = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Your browser could not convert the profile photo.")), "image/jpeg", 0.88);
  });
  if (jpeg.size > maxPhotoBytes) throw new Error("The prepared profile photo is larger than 5 MB. Choose a smaller image.");
  return new File([jpeg], "profile-photo.jpg", { type: "image/jpeg" });
}
