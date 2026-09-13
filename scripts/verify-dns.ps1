# ==============================================================================
# OpenHire DNS Verification Script (PowerShell)
# Tests live DNS resolution against public resolvers and Vercel nameservers
# ==============================================================================

Write-Host "`n🔍 Checking DNS resolution for OpenHire (openhire.in)...`n" -ForegroundColor Cyan

$domains = @(
    @{ Name = "openhire.in"; Type = "A"; Expected = "76.76.21.21" },
    @{ Name = "assessment.openhire.in"; Type = "CNAME"; Expected = "cname.vercel-dns.com" },
    @{ Name = "nova.openhire.in"; Type = "CNAME"; Expected = "cname.vercel-dns.com" },
    @{ Name = "www.openhire.in"; Type = "CNAME"; Expected = "cname.vercel-dns.com" },
    @{ Name = "openhire.in"; Type = "TXT"; Expected = "v=spf1" },
    @{ Name = "resend._domainkey.openhire.in"; Type = "CNAME"; Expected = "dkim.resend.com" },
    @{ Name = "bounces.openhire.in"; Type = "MX"; Expected = "feedback-smtp.us-east-1.amazonses.com" },
    @{ Name = "_dmarc.openhire.in"; Type = "TXT"; Expected = "v=DMARC1" }
)

foreach ($item in $domains) {
    Write-Host "Checking $($item.Type) record for $($item.Name)..." -NoNewline
    try {
        $res = Resolve-DnsName -Name $item.Name -Type $item.Type -ErrorAction Stop
        $val = if ($item.Type -eq "A") { $res.IPAddress }
               elseif ($item.Type -eq "CNAME") { $res.NameHost }
               elseif ($item.Type -eq "MX") { $res.NameExchange }
               elseif ($item.Type -eq "TXT") { $res.Strings -join " " }
        
        Write-Host " [FOUND]" -ForegroundColor Green
        Write-Host "   -> Value: $val" -ForegroundColor Gray
    } catch {
        Write-Host " [NOT FOUND / PENDING]" -ForegroundColor Yellow
        Write-Host "   -> Expected: $($item.Expected)" -ForegroundColor DarkYellow
    }
}

Write-Host "`n✅ DNS Check Complete.`n" -ForegroundColor Cyan
