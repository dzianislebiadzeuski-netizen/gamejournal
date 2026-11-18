# GameJournal: публикация кода на GitHub и запуск сборки APK.
# Запуск: двойной клик по "Опубликовать на GitHub.cmd" в этой же папке.
$ErrorActionPreference = 'Continue'
Set-Location -LiteralPath $PSScriptRoot
[Console]::OutputEncoding = [Text.Encoding]::UTF8

function Say($t, $c = 'Cyan') { Write-Host ''; Write-Host $t -ForegroundColor $c }
function RefreshPath { $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User') }
function Need($cmd, $id, $name) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Say "Устанавливаю $name (один раз)..."
    winget install --id $id -e --silent --accept-source-agreements --accept-package-agreements | Out-Host
    RefreshPath
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
      $guess = @("$env:ProgramFiles\Git\cmd", "$env:ProgramFiles\GitHub CLI", "${env:ProgramFiles(x86)}\GitHub CLI")
      foreach ($g in $guess) { if (Test-Path $g) { $env:Path += ";$g" } }
    }
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "Не получилось установить $name. Закрой окно и запусти ещё раз." }
  }
}

try {
  Need git 'Git.Git' 'Git'
  Need gh 'GitHub.cli' 'GitHub CLI'

  $here = (Get-Location).Path -replace '\\', '/'
  git config --global --add safe.directory $here 2>$null
  if (-not (git config user.name)) { git config user.name 'GameJournal' }
  if (-not (git config user.email)) { git config user.email 'noreply@users.noreply.github.com' }

  gh auth status 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Say 'Сейчас откроется GitHub в браузере.' 'Yellow'
    Say 'Скопируй код из этого окна (8 символов), вставь его на странице и нажми Authorize.' 'Yellow'
    gh auth login --hostname github.com --git-protocol https --web --scopes 'repo,workflow'
    if ($LASTEXITCODE -ne 0) { throw 'Вход в GitHub не завершён.' }
  }
  gh auth setup-git | Out-Null

  $user = (gh api user --jq .login).Trim()
  $repo = "$user/gamejournal"
  gh repo view $repo 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Say "Создаю репозиторий $repo ..."
    gh repo create gamejournal --public --description 'GameJournal — личный дневник геймера для Android' | Out-Host
  }

  Say 'Сохраняю ключ подписи в секреты репозитория...'
  $b64 = (Get-Content -LiteralPath '_signing\keystore.b64' -Raw).Trim()
  $kpass = (Get-Content -LiteralPath '_signing\password.txt' -Raw).Trim()
  gh secret set KEYSTORE_B64 --repo $repo --body $b64 | Out-Host
  gh secret set KEYSTORE_PASSWORD --repo $repo --body $kpass | Out-Host

  Say 'Отправляю код на GitHub...'
  git remote remove origin 2>$null
  git remote add origin "https://github.com/$repo.git"
  git push -u origin main --force
  if ($LASTEXITCODE -ne 0) { throw 'Не получилось отправить код.' }

  Say 'Готово! GitHub собирает APK — это займёт 5–10 минут.' 'Green'
  Say "Ход сборки:  https://github.com/$repo/actions" 'Green'
  Say "Ссылка на APK (откроется, когда сборка закончится):" 'Green'
  Write-Host "  https://github.com/$repo/releases/latest/download/GameJournal.apk" -ForegroundColor White
  Start-Process "https://github.com/$repo/actions"
}
catch {
  Say ("Ошибка: " + $_.Exception.Message) 'Red'
}
