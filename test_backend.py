import asyncio
import json
from unittest.mock import AsyncMock

import backend


def test_cari_ayat_maksimal_tiga():
    assert len(backend.cari_ayat("iman sabar salat zakat", top_k=3)) <= 3


def test_prompt_mengizinkan_jawaban_umum_dengan_pengaman():
    assert "pengetahuan umum Islam" in backend.SYSTEM_PROMPT
    assert "bukan fatwa" in backend.SYSTEM_PROMPT
    assert "maksimal 3 ayat" in backend.SYSTEM_PROMPT


def test_respons_llm_malformed_ditolak():
    response = AsyncMock()
    response.raise_for_status = lambda: None
    response.text = json.dumps({"error": "upstream gagal"})
    old_post = backend._http.post
    backend._http.post = AsyncMock(return_value=response)
    try:
        try:
            asyncio.run(backend.panggil_llm([]))
        except ValueError as exc:
            assert "choices/message/content" in str(exc)
        else:
            raise AssertionError("Respons malformed seharusnya ditolak")
    finally:
        backend._http.post = old_post


if __name__ == "__main__":
    test_cari_ayat_maksimal_tiga()
    test_prompt_mengizinkan_jawaban_umum_dengan_pengaman()
    test_respons_llm_malformed_ditolak()
    print("OK")
