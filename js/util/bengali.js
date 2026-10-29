export const bn = (n) =>
  String(Math.round(n)).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]);

export const tk = (n) => '৳' + bn(n);