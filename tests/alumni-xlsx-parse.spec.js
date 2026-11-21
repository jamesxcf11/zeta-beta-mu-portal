const { test, expect } = require('@playwright/test');

test('names: First Middle Last, suffix moved to the end, initials get a dot', async () => {
  const { parseName } = await import('../scripts/lib/alumni-xlsx.mjs');
  expect(parseName({ last: 'Abadco', first: 'Douglas', middle: 'L.' }).full_name).toBe('Douglas L. Abadco');
  expect(parseName({ last: 'Abadco', first: 'Douglas', middle: 'L' }).middle_name).toBe('L.');
  expect(parseName({ last: 'Acosta', first: 'Melanio IV', middle: 'C,' }).full_name).toBe('Melanio C. Acosta IV');
  expect(parseName({ last: 'Arcenas', first: 'Teodoro III', middle: 'R.' }).last_name).toBe('Arcenas III');
  expect(parseName({ last: 'Abelita', first: 'Gil', middle: '' }).full_name).toBe('Gil Abelita');
});

test('birthdays: dates, serials and the typos found in the sheet', async () => {
  const { parseBirthday } = await import('../scripts/lib/alumni-xlsx.mjs');
  expect(parseBirthday(new Date('1960-04-13T00:00:00Z')).iso).toBe('1960-04-13');
  expect(parseBirthday(26470).iso).toBe('1972-06-20');
  expect(parseBirthday('10/051981').iso).toBe('1981-10-05');
  expect(parseBirthday('8241985').iso).toBe('1985-08-24');
  expect(parseBirthday('01/071989').iso).toBe('1989-01-07');
  expect(parseBirthday('04 /06/1954').iso).toBe('1954-04-06');
  for (const unknownYear of ['05/19/NA', 'NA', '11/02/', '']) expect(parseBirthday(unknownYear)).toEqual({ iso: '', issue: '' });
  expect(parseBirthday('April 30*').issue).toMatch(/not understood/);
  expect(parseBirthday('02/31/1980').iso).toBe('');
});

test('phones: Philippine mobiles are normalised, landlines and foreign numbers kept', async () => {
  const { parsePhones } = await import('../scripts/lib/alumni-xlsx.mjs');
  expect(parsePhones(9196370380)).toEqual({ mobile: ['0919-637-0380'], telephone: [] });
  expect(parsePhones('9178104144\n639228865888\n639209213873').mobile).toEqual(['0917-810-4144', '0922-886-5888', '0920-921-3873']);
  expect(parsePhones('0917 844 6060').mobile).toEqual(['0917-844-6060']);
  const mixed = parsePhones('(047)2225142 \n9164016043');
  expect(mixed.mobile).toEqual(['0916-401-6043']);
  expect(mixed.telephone).toEqual(['(047)2225142']);
  expect(parsePhones('(805) 987-2772\n+18052085395').telephone).toEqual(['(805) 987-2772', '+18052085395']);
  expect(parsePhones('407-566-8438 (home)\n407-433-9810 (cell)\n').telephone).toEqual(['407-566-8438 (home)', '407-433-9810 (cell)']);
  expect(parsePhones('')).toEqual({ mobile: [], telephone: [] });
});

test('emails: repairs addresses split over lines and drops junk', async () => {
  const { parseEmails } = await import('../scripts/lib/alumni-xlsx.mjs');
  expect(parseEmails('darwinsalongamd@gmail.co\nm').valid).toEqual(['darwinsalongamd@gmail.com']);
  expect(parseEmails('gldocjonel@gmail.\ncom').valid).toEqual(['gldocjonel@gmail.com']);
  expect(parseEmails('jedsolas300@\ngmail.com').valid).toEqual(['jedsolas300@gmail.com']);
  expect(parseEmails('bertonatividad.an@gmailcom').valid).toEqual(['bertonatividad.an@gmail.com']);
  expect(parseEmails('tanjoel@rocketmail..com').valid).toEqual(['tanjoel@rocketmail.com']);
  expect(parseEmails('Lcgaurano@msn.com-pd').valid).toEqual(['lcgaurano@msn.com']);
  expect(parseEmails('a@x.com\nb@y.com; a@x.com').valid).toEqual(['a@x.com', 'b@y.com']);
  expect(parseEmails('drtimon').invalid).toEqual(['drtimon']);
});

test('specialization -> broad field used by the search filters', async () => {
  const { fieldFromSpecialization } = await import('../scripts/lib/alumni-xlsx.mjs');
  expect(fieldFromSpecialization('Interventional Cardiology')).toBe('Cardiology');
  expect(fieldFromSpecialization('General Surgery, Bariatric')).toBe('Surgery');
  expect(fieldFromSpecialization('Pediatric Neurology')).toBe('Neurology');
  expect(fieldFromSpecialization('General Pediatrics')).toBe('Pediatrics');
  expect(fieldFromSpecialization('Laser Cataract/Lens Replacement Surgery')).toBe('Ophthalmology');
  expect(fieldFromSpecialization('')).toBe('');
});

test('multi-line cells: hospitals joined, schedules keep their line breaks', async () => {
  const { joinLines, tidyMultiline } = await import('../scripts/lib/alumni-xlsx.mjs');
  expect(joinLines('A Hospital\n\n  B   Hospital \n')).toBe('A Hospital; B Hospital');
  expect(tidyMultiline('Mon 1-3pm\n\nTue 2-4pm ')).toBe('Mon 1-3pm\nTue 2-4pm');
});
