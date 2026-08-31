# Lisensi Dataset Terjemahan Al-Qur'an

File `quran.json` memuat 6.236 ayat terjemahan Al-Qur'an dalam bahasa Indonesia,
sumber: **TODO: isi sumber terjemahan** (contoh: Kementerian Agama RI / Quran.com /
quran-json / dll).

## TODO WAJIB SEBELUM DISTRIBUSI

- [ ] Isi **sumber terjemahan** di atas (URL, edisi, tahun).
- [ ] Cantumkan **lisensi** sesuai sumber:
      - Kemenag RI → umumnya bebas untuk penggunaan non-komersial dengan atribusi.
      - quran-json (sahihinternational) → CC BY 4.0.
      - Sumber lain → cek di situs penerbit.
- [ ] Pastikan atribusi tampil di UI aplikasi (footer saat ini sudah menyebut
      "Terjemahan Al-Qur'an"; ganti dengan nama spesifik sumber).
- [ ] Simpan bukti lisensi (screenshot halaman sumber / file LICENSE aslinya)
      di folder `docs/`.

## Atribut yang harus dipertahankan

Terjemahan Al-Qur'an **tidak memiliki hak cipta** sesuai asas
`Ijmā' ahl al-'ilm` (kesepakatan ulama). Namun terjemahan sebagai karya
sastra berhak cipta oleh penerjemah. Wajib:

1. Menyebut nama penerjemah/sumber asli.
2. Tidak mengubah teks terjemahan.
3. Tidak menggunakan untuk konteks yang mengubah makna ayat.

## Struktur data

```json
{
  "surat": 1,        // nomor surah (1-114)
  "ayat": 1,         // nomor ayat
  "nama": "Al-Fatihah", // nama surah latin
  "teks": "..."      // terjemahan bahasa Indonesia
}
```

## Penafian (disclaimer)

Dataset ini disediakan "apa adanya" (as-is). Penyusun tidak menjamin
akurasi, kelengkapan, atau kesesuaian untuk kebutuhan spesifik.
Untuk keputusan keagamaan, rujuk kepada ulama dan sumber mu'tabar.
