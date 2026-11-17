#!/usr/bin/env python3
"""
TaskFlow · parche de seguridad para index.html (XSS, CSP, bloqueos, textos).

Uso (desde la carpeta donde está index.html), DESPUÉS de ejecutar 10_seguridad.sql:
    python3 parche_seguridad.py                      # modifica ./index.html
    python3 parche_seguridad.py ruta/index.html
    python3 parche_seguridad.py --sri=sha384-XXXX    # opcional: integridad (SRI) de supabase-js

Crea antes una copia de seguridad index.html.bak.
Los cambios ya aplicados (por ejemplo por parche_textos_largos.py) se omiten.
Si algo obligatorio no se encuentra, o queda HTML sin escapar, avisa y no toca nada.
"""
import re
import shutil
import sys

args = [a for a in sys.argv[1:] if not a.startswith("--")]
sri = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--sri=")), "")
path = args[0] if args else "index.html"
out = open(path, encoding="utf-8").read()


def rep(old, new, label, count=None, required=False):
    global out
    n = out.count(old)
    if n == 0:
        if required:
            sys.exit(f"ERROR: no se encontró «{label}». No se ha modificado nada.")
        print(f"--  {label} (ya aplicado u omitido)")
        return
    if count is not None and n != count:
        sys.exit(f"ERROR: «{label}» aparece {n} veces (se esperaban {count}). No se ha modificado nada.")
    out = out.replace(old, new)
    print(f"OK  {label} ({n})")


# 1) XSS: escapar todo el texto de usuarios que se inserta como HTML
rep("""'<h3>' + t.title + '</h3>""", """'<h3>' + esc(t.title) + '</h3>""", "título de tarjetas", 3)
rep("""+ t.cardDesc + '</p>'""", """+ esc(t.cardDesc) + '</p>'""", "descripción de tarjetas", 3)
rep("""<span class="tag">' + t.tag +""", """<span class="tag">' + esc(t.tag) +""", "categoría de tarjetas", 3)
rep("""'<span class="price">' + t.price + '</span>'""", """'<span class="price">' + esc(t.price) + '</span>'""", "precio de tarjetas", 2)
rep("""<span class="price">' + (st.agreedPrice || t.price) + '</span>""", """<span class="price">' + esc(st.agreedPrice || t.price) + '</span>""", "precio acordado", 1)
rep("""'<span class="cand-name">' + c.name + '</span>'""", """'<span class="cand-name">' + esc(c.name) + '</span>'""", "nombre de candidato", 1)
rep("""'<span class="cand-price">' + c.price + '</span>'""", """'<span class="cand-price">' + esc(c.price) + '</span>'""", "precio de candidato", 1)
rep("""'<p>' + c.message + '</p>'""", """'<p>' + esc(c.message) + '</p>'""", "mensaje de candidato", 1)
rep("""t.desc.map(function(p){return '<p>'+p+'</p>';})""", """t.desc.map(function(p){return '<p>'+esc(p)+'</p>';})""", "descripción en el detalle", 1)

# 2) Avatar: solo imágenes JPEG en base64 (evita imágenes externas que rastrean a quien ve el perfil)
rep("if(acc.avatar){", r"if(acc.avatar && /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(acc.avatar)){", "validar avatar", 1)

# 3) Bloqueos: ahora viven en la tabla «blocks» (SQL 10)
rep("sb.from('reviews').select('*').order('created_at', { ascending: false })",
    "sb.from('reviews').select('*').order('created_at', { ascending: false }),\n      sb.from('blocks').select('*')",
    "consulta de bloqueos", 1, required=True)
rep("REVIEWS = (res[9] && res[9].data) || [];",
    "REVIEWS = (res[9] && res[9].data) || [];\n    var BLK = {}; ((res[10] && res[10].data) || []).forEach(function(b){ BLK[b.user_id] = b; });",
    "mapa de bloqueos", 1, required=True)
rep("blockedUntil: p.blocked_until || null, blockedReason: p.blocked_reason || '',",
    "blockedUntil: (BLK[p.id] && BLK[p.id].blocked_until) || null, blockedReason: (BLK[p.id] && BLK[p.id].blocked_reason) || '',",
    "bloqueo en el perfil", 1, required=True)

# 4) Límites de caracteres al escribir (los de la base de datos son los que mandan)
rep('<input id="reg-name" type="text" required>', '<input id="reg-name" type="text" maxlength="60" required>', "máx. nombre (registro)", 1)
rep('<input id="mp-name" type="text" required>', '<input id="mp-name" type="text" maxlength="60" required>', "máx. nombre (perfil)", 1)
rep('id="titulo" type="text" placeholder', 'id="titulo" type="text" maxlength="80" placeholder', "máx. título")
rep('<textarea id="descripcion" placeholder', '<textarea id="descripcion" maxlength="2000" placeholder', "máx. descripción")
rep('id="chat-input" type="text" placeholder', 'id="chat-input" type="text" maxlength="1000" placeholder', "máx. mensaje de chat")
rep('<input type="text" id="det-msg" placeholder', '<input type="text" id="det-msg" maxlength="500" placeholder', "máx. mensaje de candidatura")

# 5) Textos que no son ciertos (no hay pagos) y textos de prueba
rep("Tareas puntuales, pago protegido", "Tareas puntuales entre personas", "texto «pago protegido» (portada)")
rep("Encarga el trabajo. Págalo cuando esté hecho.", "Encarga el trabajo. Apruébalo por entregas.", "titular de la portada")
rep("y libera el pago solo cuando apruebes la entrega.", "y aprueba cada entrega antes de darla por buena.", "subtítulo de la portada")
rep("Pago protegido en cada tarea", "Tareas puntuales entre personas", "pie de página")
rep('<p style="margin-top:14px;font-size:.8rem;color:var(--text-dim);">Para probar la otra parte de la conversación, cierra sesión y entra con la otra cuenta.</p>',
    "", "texto de prueba del chat")

# 6) CSP: solo scripts propios y jsDelivr; las conexiones solo a tu Supabase (evita robar sesiones aunque haya un XSS)
if "Content-Security-Policy" not in out:
    m = re.search(r"var SUPABASE_URL = 'https://([a-z0-9-]+\.supabase\.co)'", out)
    if not m:
        sys.exit("ERROR: no se encontró SUPABASE_URL para construir la CSP. No se ha modificado nada.")
    h = m.group(1)
    csp = ("default-src 'none'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
           "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; "
           f"img-src 'self' data: blob: https://{h}; connect-src 'self' https://{h} wss://{h}; "
           "object-src 'none'; base-uri 'none'; form-action 'self'")
    rep("<title>TaskFlow — Portal de tareas</title>",
        f'<meta http-equiv="Content-Security-Policy" content="{csp}">\n<title>TaskFlow — Portal de tareas</title>',
        "política de seguridad de contenido (CSP)", 1, required=True)
else:
    print("--  CSP (ya aplicada)")

# 7) SRI opcional para supabase-js
if sri:
    rep('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>',
        f'<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js" integrity="{sri}" crossorigin="anonymous"></script>',
        "SRI de supabase-js", 1, required=True)

# Comprobación final: no debe quedar HTML sin escapar
left = ["'<h3>' + t.title", "+ t.tag + '</span>", "+ t.cardDesc + '</p>", "+ c.name + '</span>", "+ c.message + '</p>", "'<p>'+p+'</p>'"]
bad = [p for p in left if p in out]
if bad:
    sys.exit("ERROR: queda texto sin escapar en: " + ", ".join(bad) + ". No se ha modificado nada.")

shutil.copyfile(path, path + ".bak")
open(path, "w", encoding="utf-8").write(out)
print("\nListo. Copia de seguridad en", path + ".bak")
