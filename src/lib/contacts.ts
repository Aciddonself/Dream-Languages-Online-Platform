const enquiryMessage = "Hello DLA, I would like to make an enquiry.";

export const whatsappContacts = [
  {
    label: "WhatsApp DLA 1",
    number: "+256 742 259 976",
    href: `https://wa.me/256742259976?text=${encodeURIComponent(enquiryMessage)}`,
  },
  {
    label: "WhatsApp DLA 2",
    number: "+256 775 566 832",
    href: `https://wa.me/256775566832?text=${encodeURIComponent(enquiryMessage)}`,
  },
] as const;
