package com.project.backend.service;

public interface InvoiceService {
    /**
     * 模擬生成符合台灣電子發票格式的發票號碼（如：AB-12345678）
     */
    String generateInvoiceNo();

    /**
     * 驗證手機載具格式
     * 格式規則：斜線開頭，後接7碼大寫英數字或特殊字元（.+-）
     */
    void validateCarrierNo(String carrierNo);

    /**
     * 驗證愛心碼格式
     * 格式規則：3-7碼數字
     */
    void validateLoveCode(String loveCode);
}
