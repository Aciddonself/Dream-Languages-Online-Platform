const maxPhotoBytes = 5 * 1024 * 1024;
const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function prepareProfilePhoto(file: File) {
  if (!supportedTypes.has(file.type) || file.size < 1 || file.size > maxPhotoBytes) {
    throw new Error("Choose a JPG, PNG, or WebP photo no larger than 5 MB.");
  }
  const bitmap = await createImageBitmap(file);
  const aspectRatio = 7 / 9;
  const cropWidth = bitmap.width / bitmap.height > aspectRatio ? bitmap.height * aspectRatio : bitmap.width;
  const cropHeight = bitmap.width / bitmap.height > aspectRatio ? bitmap.height : bitmap.width / aspectRatio;
  const cropX = (bitmap.width - cropWidth) / 2;
  const cropY = (bitmap.height - cropHeight) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = 840;
  canvas.height = 1080;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Your browser could not prepare the profile photo.");
  }
  context.drawImage(bitmap, cropX, cropY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const jpeg = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Your browser could not convert the profile photo.")), "image/jpeg", 0.88);
  });
  if (jpeg.size > maxPhotoBytes) throw new Error("The prepared profile photo is larger than 5 MB. Choose a smaller image.");
  return new File([jpeg], "profile-photo.jpg", { type: "image/jpeg" });
}
