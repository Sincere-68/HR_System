[CmdletBinding()]
param(
    [string]$ConfigPath = (Join-Path (Split-Path -Parent $PSScriptRoot) '.italent.config.json'),
    [string]$InputJsonPath,
    [string]$OutputPath = (Join-Path (Split-Path -Parent $PSScriptRoot) '考核指标.md')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-TextValue {
    param([object]$Field)

    if ($null -eq $Field -or $null -eq $Field.Text) {
        return $null
    }

    return ([string]$Field.Text).Trim()
}

function Add-MarkdownText {
    param(
        [System.Collections.Generic.List[string]]$Lines,
        [string]$Text
    )

    if ([string]::IsNullOrWhiteSpace($Text)) {
        return
    }

    # Preserve line breaks when rendered by Markdown viewers.
    $Lines.Add(($Text.Trim() -replace "\r?\n", "  `n"))
    $Lines.Add('')
}

function Get-GoalTemplateResponse {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "找不到配置文件：$Path"
    }

    $config = Get-Content -Raw -Encoding UTF8 -LiteralPath $Path | ConvertFrom-Json
    if ([string]::IsNullOrWhiteSpace($config.requestUrl)) {
        throw '配置文件缺少 requestUrl。'
    }

    $headers = @{
        Accept        = 'application/json, application/xml, text/plain, text/html, */*'
        'X-Sourced-By' = 'ajax'
    }

    foreach ($name in 'referer', 'tenantId', 'userId', 'vid') {
        $value = $config.$name
        if (-not [string]::IsNullOrWhiteSpace($value)) {
            $headerName = switch ($name) {
                'tenantId' { 'tenant_id' }
                'userId' { 'user_id' }
                default { $name }
            }
            $headers[$headerName] = [string]$value
        }
    }

    if (-not [string]::IsNullOrWhiteSpace($config.cookie)) {
        $headers.Cookie = [string]$config.cookie
    }

    try {
        $result = Invoke-WebRequest -Method Get -Uri $config.requestUrl -Headers $headers -UseBasicParsing
    }
    catch {
        throw "接口请求失败。请确认已更新本机 Cookie，且 requestUrl 中的 quark_s 尚有效。原始错误：$($_.Exception.Message)"
    }

    return $result.Content | ConvertFrom-Json
}

if ($InputJsonPath) {
    if (-not (Test-Path -LiteralPath $InputJsonPath)) {
        throw "找不到 JSON 文件：$InputJsonPath"
    }
    $response = Get-Content -Raw -Encoding UTF8 -LiteralPath $InputJsonPath | ConvertFrom-Json
}
else {
    $response = Get-GoalTemplateResponse -Path $ConfigPath
}

if (-not $response.Success -or $null -eq $response.Data) {
    throw "接口未返回模板数据：$($response.Msg)"
}

$lines = [System.Collections.Generic.List[string]]::new()
$lines.Add('# ' + $response.Data.GoalTemplateName)
$lines.Add('')

foreach ($module in $response.Data.ModuleList | Sort-Object OrderIndex) {
    $lines.Add('## ' + $module.Name)
    $lines.Add('')
    Add-MarkdownText -Lines $lines -Text $module.Description

    foreach ($item in $module.BizDataList) {
        $name = Get-TextValue -Field $item.Name
        $description = Get-TextValue -Field $item.Description
        $metrics = Get-TextValue -Field $item.Metrics
        $weight = Get-TextValue -Field $item.Weight

        $lines.Add('### ' + $(if ($name) { $name } else { '未命名指标' }))
        $lines.Add('')

        if ($weight) {
            $lines.Add('- 权重：' + $weight)
        }
        if ($description) {
            $lines.Add('- 指标描述：')
            $lines.Add('')
            Add-MarkdownText -Lines $lines -Text $description
        }
        if ($metrics) {
            $lines.Add('- 衡量标准：')
            $lines.Add('')
            Add-MarkdownText -Lines $lines -Text $metrics
        }
        if (-not $weight -and -not $description -and -not $metrics) {
            $lines.Add('暂无文字内容。')
            $lines.Add('')
        }
    }
}

$outputDirectory = Split-Path -Parent $OutputPath
if (-not (Test-Path -LiteralPath $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}

[System.IO.File]::WriteAllText(
    (Resolve-Path -LiteralPath $outputDirectory).Path + [System.IO.Path]::DirectorySeparatorChar + (Split-Path -Leaf $OutputPath),
    ($lines -join [Environment]::NewLine),
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host "已生成：$OutputPath"
