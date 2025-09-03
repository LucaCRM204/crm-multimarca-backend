# Script para crear 18 vendedores bajo Daniel Mottino
$baseUrl = "https://alluma-crm-backend-production.up.railway.app/api"
$ownerEmail = "Luca@alluma.com"

# Contrasena del Owner
$ownerPassword = Read-Host -Prompt "Contrasena del Owner" -AsSecureString
$ownerPasswordText = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($ownerPassword))

Write-Host ""
Write-Host "=== CREANDO ESTRUCTURA BAJO DANIEL MOTTINO ==="
Write-Host ""

# 1. Login
Write-Host "1. Autenticando..."
$loginData = @{ 
    email = $ownerEmail
    password = $ownerPasswordText 
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body $loginData -ContentType "application/json"
    
    if ($loginResponse.ok -and $loginResponse.token) {
        $token = $loginResponse.token
        Write-Host "   Autenticacion exitosa"
    } else {
        Write-Host "   Error en login"
        exit 1
    }
} catch {
    Write-Host "   Error en login: $($_.Exception.Message)"
    exit 1
}

# 2. Buscar supervisores
Write-Host "2. Buscando supervisores..."
$headers = @{ 
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

try {
    $users = Invoke-RestMethod -Uri "$baseUrl/users" -Method GET -Headers $headers
    
    # Buscar Supervisor M1
    $supervisorM1 = $users | Where-Object { $_.name -eq "Supervisor M1" }
    if (-not $supervisorM1) {
        Write-Host "   Error: No se encontro Supervisor M1"
        exit 1
    }
    
    # Buscar Supervisor M2  
    $supervisorM2 = $users | Where-Object { $_.name -eq "Supervisor M2" }
    if (-not $supervisorM2) {
        Write-Host "   Error: No se encontro Supervisor M2"
        exit 1
    }
    
    Write-Host "   Supervisor M1 encontrado (ID: $($supervisorM1.id))"
    Write-Host "   Supervisor M2 encontrado (ID: $($supervisorM2.id))"
    
} catch {
    Write-Host "   Error obteniendo usuarios: $($_.Exception.Message)"
    exit 1
}

# 3. Crear vendedores bajo Supervisor M1
Write-Host "3. Creando 9 vendedores bajo Supervisor M1..."

$vendedoresM1 = 0
for ($i = 1; $i -le 9; $i++) {
    $numero = $i.ToString("D2")
    $nombre = "Vendedor$numero M1"
# Script para crear 18 vendedores bajo Daniel Mottino
$baseUrl = "https://alluma-crm-backend-production.up.railway.app/api"
$ownerEmail = "Luca@alluma.com"

# Contrasena del Owner
$ownerPassword = Read-Host -Prompt "Contrasena del Owner" -AsSecureString
$ownerPasswordText = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($ownerPassword))

Write-Host ""
Write-Host "=== CREANDO ESTRUCTURA BAJO DANIEL MOTTINO ==="
Write-Host ""

# 1. Login
Write-Host "1. Autenticando..."
$loginData = @{ 
    email = $ownerEmail
    password = $ownerPasswordText 
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body $loginData -ContentType "application/json"
    
    if ($loginResponse.ok -and $loginResponse.token) {
        $token = $loginResponse.token
        Write-Host "   Autenticacion exitosa"
    } else {
        Write-Host "   Error en login"
        exit 1
    }
} catch {
    Write-Host "   Error en login: $($_.Exception.Message)"
    exit 1
}

# 2. Buscar supervisores
Write-Host "2. Buscando supervisores..."
$headers = @{ 
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

try {
    $users = Invoke-RestMethod -Uri "$baseUrl/users" -Method GET -Headers $headers
    
    # Buscar Supervisor M1
    $supervisorM1 = $users | Where-Object { $_.name -eq "Supervisor M1" }
    if (-not $supervisorM1) {
        Write-Host "   Error: No se encontro Supervisor M1"
        exit 1
    }
    
    # Buscar Supervisor M2  
    $supervisorM2 = $users | Where-Object { $_.name -eq "Supervisor M2" }
    if (-not $supervisorM2) {
        Write-Host "   Error: No se encontro Supervisor M2"
        exit 1
    }
    
    Write-Host "   Supervisor M1 encontrado (ID: $($supervisorM1.id))"
    Write-Host "   Supervisor M2 encontrado (ID: $($supervisorM2.id))"
    
} catch {
    Write-Host "   Error obteniendo usuarios: $($_.Exception.Message)"
    exit 1
}

# 3. Crear vendedores bajo Supervisor M1
Write-Host "3. Creando 9 vendedores bajo Supervisor M1..."

$vendedoresM1 = 0
for ($i = 1; $i -le 9; $i++) {
    $numero = $i.ToString("D2")
    $nombre = "Vendedor$numero M1"
    $email = "vendedor$numero.m1"
    
    $userData = @{
        name = $nombre
        email = $email
        password = "123456"
        role = "vendedor"
        reportsTo = $supervisorM1.id
        active = 1
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/users" -Method POST -Body $userData -Headers $headers
        Write-Host "   $nombre creado"
        $vendedoresM1++
    } catch {
        Write-Host "   Error creando $nombre"
    }
    
    Start-Sleep -Milliseconds 300
}

# 4. Crear vendedores bajo Supervisor M2
Write-Host "4. Creando 9 vendedores bajo Supervisor M2..."

$vendedoresM2 = 0
for ($i = 1; $i -le 9; $i++) {
    $numero = $i.ToString("D2")
    $nombre = "Vendedor$numero M2"
    $email = "vendedor$numero.m2"
    
    $userData = @{
        name = $nombre
        email = $email
        password = "123456"
        role = "vendedor"
        reportsTo = $supervisorM2.id
        active = 1
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/users" -Method POST -Body $userData -Headers $headers
        Write-Host "   $nombre creado"
        $vendedoresM2++
    } catch {
        Write-Host "   Error creando $nombre"
    }
    
    Start-Sleep -Milliseconds 300
}

# Limpiar contrasena
$ownerPasswordText = $null

# 5. Resumen
Write-Host ""
Write-Host "=== RESUMEN ==="
Write-Host "Vendedores M1: $vendedoresM1/9"
Write-Host "Vendedores M2: $vendedoresM2/9" 
Write-Host "Total: $($vendedoresM1 + $vendedoresM2)/18"
Write-Host ""
Write-Host "Estructura:"
Write-Host "Daniel Mottino (Gerente)"
Write-Host "- Supervisor M1 (9 vendedores)"
Write-Host "- Supervisor M2 (9 vendedores)"
Write-Host ""
Write-Host "Contrasena por defecto: 123456"
    
    $userData = @{
        name = $nombre
        email = $email
        password = "123456"
        role = "vendedor"
        reportsTo = $supervisorM1.id
        active = 1
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/users" -Method POST -Body $userData -Headers $headers
        Write-Host "   $nombre creado"
        $vendedoresM1++
    } catch {
        Write-Host "   Error creando $nombre"
    }
    
    Start-Sleep -Milliseconds 300
}

# 4. Crear vendedores bajo Supervisor M2
Write-Host "4. Creando 9 vendedores bajo Supervisor M2..."

$vendedoresM2 = 0
for ($i = 1; $i -le 9; $i++) {
    $numero = $i.ToString("D2")
    $nombre = "Vendedor$numero M2"
    $email = "vendedor$numero.m2@alluma.com"
    
    $userData = @{
        name = $nombre
        email = $email
        password = "123456"
        role = "vendedor"
        reportsTo = $supervisorM2.id
        active = 1
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/users" -Method POST -Body $userData -Headers $headers
        Write-Host "   $nombre creado"
        $vendedoresM2++
    } catch {
        Write-Host "   Error creando $nombre"
    }
    
    Start-Sleep -Milliseconds 300
}

# Limpiar contrasena
$ownerPasswordText = $null

# 5. Resumen
Write-Host ""
Write-Host "=== RESUMEN ==="
Write-Host "Vendedores M1: $vendedoresM1/9"
Write-Host "Vendedores M2: $vendedoresM2/9" 
Write-Host "Total: $($vendedoresM1 + $vendedoresM2)/18"
Write-Host ""
Write-Host "Estructura:"
Write-Host "Daniel Mottino (Gerente)"
Write-Host "- Supervisor M1 (9 vendedores)"
Write-Host "- Supervisor M2 (9 vendedores)"
Write-Host ""
Write-Host "Contrasena por defecto: 123456"