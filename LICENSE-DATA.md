# Lisensi Dataset Terjemahan Al-Qur'an

File `quran.json` memuat 6.236 ayat terjemahan Al-Qur'an dalam bahasa Indonesia.

## Sumber

**Kementerian Agama Republik Indonesia (Kemenag RI)** — Al-Qur'an dan
Terjemahnya, edisi yang disebarluaskan melalui portal resmi dan turunannya.

- Portal resmi: <https://quran.kemenag.go.id/>
- Lembaga: Kementerian Agama RI, Republik Indonesia
- Tahun rujukan: terjemahan edisi yang tersedia di portal Kemenag.

## Lisensi

Terjemahan Al-Qur'an Kemenag RI disebarluaskan untuk penggunaan umum dengan
syarat **atribusi**. Ketentuan yang berlaku:

1. **Atribusi wajib** — cantumkan "Kementerian Agama RI" sebagai sumber
   pada setiap tampilan yang memuat teks terjemahan.
2. **Non-komersial** — penggunaan untuk kepentingan komersial
   (misalnya iklan monetisasi, produk berbayar, penjualan kembali)
   membutuhkan izin tertulis dari Kemenag RI.
3. **Tidak mengubah teks** — terjemahan tidak boleh disunting, diringkas,
   atau ditambah tanpa izin.
4. **Konteks benar** — tidak digunakan untuk mengubah makna ayat atau
   untuk konteks yang menyesatkan.

## Asas teks ayat

Teks ayat Al-Qur'an sendiri (teks Arab, mushaf) bukan objek hak cipta
berdasarkan `Ijmā' ahl al-'ilm` (kesepakatan ulama). Yang berhak cipta
adalah **terjemahan** sebagai karya sastra oleh penerjemah — dalam hal ini
Kemenag RI.

## Atribusi yang ditampilkan aplikasi

Footer aplikasi memuat teks:
> "Terjemahan Al-Qur'an oleh Kementerian Agama RI"

Lokasi: `public/index.html`, elemen `<footer>`, baris `.credit`.

## Struktur data

```json
{
  "surat": 1,            // nomor surah (1-114)
  "ayat": 1,             // nomor ayat dalam surah
  "nama": "Al-Fatihah",  // nama surah (latin/Indonesia)
  "teks": "..."          // terjemahan bahasa Indonesia oleh Kemenag RI
}
```

## Penafian (disclaimer)

Dataset dan aplikasi disediakan "apa adanya" (as-is). Penyusun tidak
menjamin akurasi, kelengkapan, atau kesesuaian untuk kebutuhan spesifik.
Untuk keputusan keagamaan, rujuk kepada ulama dan sumber mu'tabar.
