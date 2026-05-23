package com.project.backend.service.impl;

import com.project.backend.service.InvoiceService;
import org.springframework.stereotype.Service;

import java.util.concurrent.ThreadLocalRandom;
import java.util.regex.Pattern;

@Service
public class InvoiceServiceImpl implements InvoiceService {

    // 載具正規表示式：斜線開頭，後接7碼大寫英數字或點、加、減符號
    private static final Pattern CARRIER_PATTERN = Pattern.compile("^/[A-Z0-9.+-]{7}$");
    
    // 愛心碼正規表示式：3-7位數字
    private static final Pattern LOVE_CODE_PATTERN = Pattern.compile("^[0-9]{3,7}$");

    @Override
    public String generateInvoiceNo() {
        ThreadLocalRandom random = ThreadLocalRandom.current();
        
        // 隨機生成2個大寫英文字母
        char char1 = (char) ('A' + random.nextInt(26));
        char char2 = (char) ('A' + random.nextInt(26));
        
        // 隨機生成8位數字
        int number = random.nextInt(100000000); // 0 到 99999999
        String numStr = String.format("%08d", number);
        
        return "" + char1 + char2 + "-" + numStr;
    }

    @Override
    public void validateCarrierNo(String carrierNo) {
        if (carrierNo == null || carrierNo.trim().isEmpty()) {
            return;
        }
        if (!CARRIER_PATTERN.matcher(carrierNo.trim()).matches()) {
            throw new IllegalArgumentException("手機載具格式不符合規範，應以「/」開頭接7碼大寫英數字及符號（例如：/ABC1234）");
        }
    }

    @Override
    public void validateLoveCode(String loveCode) {
        if (loveCode == null || loveCode.trim().isEmpty()) {
            return;
        }
        if (!LOVE_CODE_PATTERN.matcher(loveCode.trim()).matches()) {
            throw new IllegalArgumentException("愛心碼格式不符合規範，應為3至7碼數字（例如：519）");
        }
    }
}
