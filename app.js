        function crearEfectosMundialistas() {
            const container = document.getElementById('floating-background');
            const emojis = ['🇦🇷', '🇧🇷', '🇫🇷', '🇩🇪', '🇪🇸', '🇵🇦', '🇨🇴', '🇺🇾', '🇲🇽', '🇺🇸', '🇬🇧', '🇵🇹', '🇳🇱', '🇧🇪', '🇮🇹', '🏆', '🏆', '🏆', '⚽', '🥇'];
            const numElements = 35; 

            for (let i = 0; i < numElements; i++) {
                const el = document.createElement('div');
                el.innerText = emojis[Math.floor(Math.random() * emojis.length)];
                el.className = 'floating-item';
                
                const left = Math.random() * 100; 
                const duration = 12 + Math.random() * 25; 
                const delay = Math.random() * 20; 
                const fontSize = 1.5 + Math.random() * 3; 

                el.style.left = `${left}vw`;
                el.style.animationDuration = `${duration}s`;
                el.style.animationDelay = `-${delay}s`; 
                el.style.fontSize = `${fontSize}rem`;

                container.appendChild(el);
            }
        }

        const TARIFA_SERVICIO = 0.50; 
        const PORCENTAJE_CASA = 0.60; 
        const MULTIPLICADOR_MAXIMO = 10; 
        const NUMERO_WHATSAPP = "50763305117"; 

        const BASE_URL = '';

        let currentUser = null; 
        let dbTickets = []; 
        let dbPartidos = []; 

        let bovedaSupremaTotal = 0; 
        let tempApuesta = null;

        document.addEventListener("DOMContentLoaded", () => {
            crearEfectosMundialistas(); 
            actualizarNavegacion();
            // Iniciar sincronización con servidor cada 5 segundos para que sea en tiempo real
            setInterval(cargarDatosDelServidor, 5000);
        });

        async function cargarDatosDelServidor() {
            try {
                const resPartidos = await fetch(`${BASE_URL}/api/partidos`);
                const dataPartidos = await resPartidos.json();
                if(dataPartidos.success) {
                    dbPartidos = dataPartidos.partidos.map(p => ({
                        id: parseInt(p.id),
                        fecha: p.fecha,
                        eq1: p.eq1,
                        eq2: p.eq2,
                        estado: p.estado,
                        ganador: p.ganador
                    }));
                }

                const resTickets = await fetch(`${BASE_URL}/api/tickets`);
                const dataTickets = await resTickets.json();
                if(dataTickets.success) {
                    dbTickets = dataTickets.tickets;
                }

                if(!document.getElementById('modulo-admin').classList.contains('hidden')) {
                    actualizarVistaAdmin();
                }
                if(!document.getElementById('modulo-cliente').classList.contains('hidden')) {
                    const selectorActual = document.getElementById('c-partido-select').value;
                    cargarSelectorPartidosCliente(selectorActual);
                    renderizarTicketsCliente();
                }
            } catch (e) {
                console.error("Error conectando a Node.js:", e);
            }
        }

        function abrirModalReglas() {
            document.getElementById('modal-reglas').classList.remove('hidden');
        }

        function getTotalesPartido(partidoId) {
            const ticketsAprobados = dbTickets.filter(t => t.partidoId === partidoId && t.aprobado);
            let pTotal = 0, pEq1 = 0, pEmp = 0, pEq2 = 0, tFijas = 0;
            
            ticketsAprobados.forEach(t => {
                pTotal += t.monto;
                tFijas += TARIFA_SERVICIO;
                if(t.prediccion === 'EQ1') pEq1 += t.monto;
                if(t.prediccion === 'EMP') pEmp += t.monto;
                if(t.prediccion === 'EQ2') pEq2 += t.monto;
            });

            return { pTotal, pEq1, pEmp, pEq2, tFijas };
        }

        function calcularPremio(montoApostado, prediccion, totales) {
            let pozoFavorito = prediccion === 'EQ1' ? totales.pEq1 : (prediccion === 'EMP' ? totales.pEmp : totales.pEq2);
            
            const dineroPerdedores = totales.pTotal - pozoFavorito;
            if(dineroPerdedores <= 0) return montoApostado;

            const dineroARepartir = dineroPerdedores * (1 - PORCENTAJE_CASA); 
            const proporcion = montoApostado / pozoFavorito; 
            let premioTeorico = montoApostado + (proporcion * dineroARepartir);

            let topeMaximoPermitido = montoApostado * MULTIPLICADOR_MAXIMO;
            return premioTeorico > topeMaximoPermitido ? topeMaximoPermitido : premioTeorico;
        }

        function calcularGananciaNetaCasa(partidoId, ganadorSimulado) {
            const totales = getTotalesPartido(partidoId);
            if (totales.pTotal === 0) return 0;
            
            let totalPagadoClientes = 0;
            dbTickets.forEach(t => {
                if (t.partidoId === partidoId && t.aprobado && t.prediccion === ganadorSimulado) {
                    totalPagadoClientes += calcularPremio(t.monto, t.prediccion, totales);
                }
            });
            
            let gananciaNeta = totales.pTotal - totalPagadoClientes;
            return gananciaNeta > 0 ? gananciaNeta : 0;
        }

        function getNombreEquipo(partido, prediccion) {
            return prediccion === 'EQ1' ? partido.eq1 : (prediccion === 'EMP' ? 'EMPATE' : partido.eq2);
        }

        async function crearNuevoPartido() {
            const eq1 = document.getElementById('config-eq1').value.trim().toUpperCase();
            const eq2 = document.getElementById('config-eq2').value.trim().toUpperCase();

            if(!eq1 || !eq2) { alert("❌ Ingresa el nombre de los países."); return; }

            const response = await fetch(`${BASE_URL}/api/partidos/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eq1, eq2 })
            });
            
            const data = await response.json();
            if(data.success) {
                document.getElementById('config-eq1').value = "";
                document.getElementById('config-eq2').value = "";
                await cargarDatosDelServidor();
                alert(`✅ PARTIDO ESTELAR CREADO: ${eq1} vs ${eq2}.\nLa taquilla está abierta para recibir boletos.`);
            } else {
                alert("Error: " + data.message);
            }
        }

        async function bloquearPartidoAdmin(partidoId) {
            const partido = dbPartidos.find(p => p.id === partidoId);
            if(!partido) return;

            if(confirm(`⏱️ ¿Iniciar partido ${partido.eq1} vs ${partido.eq2}?\n\nLa taquilla se cerrará y los clientes ya no podrán apostar.`)) {
                await fetch(`${BASE_URL}/api/partidos/start`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: partidoId })
                });
                await cargarDatosDelServidor();
            }
        }

        async function finalizarPartidoAdmin(partidoId, ganadorCodigo) {
            const partido = dbPartidos.find(p => p.id === partidoId);
            if(!partido || partido.estado === 'FINALIZADO') return;

            const pendientes = dbTickets.filter(t => t.partidoId === partidoId && !t.aprobado);
            if(pendientes.length > 0) {
                alert("⚠️ Hay hinchas esperando aprobación. Acéptalos o recházalos antes de pitar el final.");
                return;
            }

            const nombreGanador = ganadorCodigo === 'EQ1' ? partido.eq1 : (ganadorCodigo === 'EMP' ? 'EMPATE' : partido.eq2);

            if(confirm(`ATENCIÓN: ¿Pitar el final del partido y declarar a ${nombreGanador} como ganador oficial?`)) {
                const res = await fetch(`${BASE_URL}/api/partidos/finish`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: partidoId, ganador: ganadorCodigo })
                });
                const data = await res.json();
                if(data.success) {
                    await cargarDatosDelServidor();
                } else {
                    alert("Error: " + data.message);
                }
            }
        }

        async function registrarUsuario(e) {
            e.preventDefault();
            const nombre = document.getElementById('reg-nombre').value.trim();
            const cedula = document.getElementById('reg-cedula').value.trim();
            const password = document.getElementById('reg-password').value;

            const res = await fetch(`${BASE_URL}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre, cedula, password })
            });
            const data = await res.json();

            if (data.success) {
                currentUser = data.user;
                e.target.reset();
                await cargarDatosDelServidor();
                iniciarSesionExitosa();
            } else {
                alert("❌ " + data.message);
            }
        }

        async function loginUsuario(e) {
            e.preventDefault();
            const cedula = document.getElementById('login-cedula').value.trim();
            const password = document.getElementById('login-password').value;

            const res = await fetch(`${BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cedula, password })
            });
            const data = await res.json();

            if (data.success) {
                currentUser = data.user;
                e.target.reset();
                await cargarDatosDelServidor();
                iniciarSesionExitosa();
            } else { 
                alert("❌ " + data.message); 
            }
        }

        function iniciarSesionExitosa() {
            document.getElementById('display-nombre-usuario').innerText = currentUser.nombre;
            document.getElementById('display-cedula-usuario').innerText = currentUser.cedula;
            actualizarNavegacion();
            cambiarModulo('cliente');
        }

        function cerrarSesion() {
            currentUser = null;
            actualizarNavegacion();
            cambiarModulo('auth');
            document.getElementById('resultados-cliente').innerHTML = "";
            resetearFormularioApuestaCliente();
        }

        function actualizarNavegacion() {
            const container = document.getElementById('nav-buttons');
            const btnReglas = `<button onclick="abrirModalReglas()" class="text-yellow-400 hover:text-yellow-300 underline font-bold text-xs sm:text-sm tracking-wide transition mr-2">📜 REGLAS</button>`;
            
            if(currentUser) {
                container.innerHTML = `
                    ${btnReglas}
                    <button onclick="cambiarModulo('cliente')" class="hidden sm:inline-block text-yellow-400 hover:text-white px-3 py-2 rounded text-sm font-bold uppercase tracking-wider transition">Mi Vestuario</button>
                    <button onclick="cerrarSesion()" class="bg-red-500/20 text-red-400 hover:bg-red-500/40 px-3 py-2 rounded-lg font-bold text-sm ml-2 border border-red-500/50 cursor-pointer transition">Salir</button>
                `;
            } else {
                container.innerHTML = `
                    ${btnReglas}
                    <button onclick="cambiarModulo('auth')" class="gold-gradient text-slate-900 px-4 py-2 rounded-lg font-black text-sm transition shadow-[0_0_10px_rgba(245,158,11,0.5)]">Jugar ⚽</button>
                    <button onclick="intentarAccesoAdmin()" class="bg-slate-900 text-slate-300 px-4 py-2 rounded-lg font-bold text-sm border border-slate-600 ml-2 cursor-pointer hover:bg-slate-800 transition">Admin 🔒</button>
                `;
            }
        }

        async function cambiarModulo(modulo) {
            const secAuth = document.getElementById('modulo-auth');
            const secCli = document.getElementById('modulo-cliente');
            const secAdm = document.getElementById('modulo-admin');

            secAuth.classList.add('hidden'); secCli.classList.add('hidden'); secAdm.classList.add('hidden');

            if(modulo === 'auth') { 
                secAuth.classList.remove('hidden'); 
            } 
            else if(modulo === 'cliente') {
                if(!currentUser) { cambiarModulo('auth'); return; }
                secCli.classList.remove('hidden');
                await cargarDatosDelServidor();
                cargarSelectorPartidosCliente();
                renderizarTicketsCliente(); 
            } else if(modulo === 'admin') {
                secAdm.classList.remove('hidden');
                await cargarDatosDelServidor();
                actualizarVistaAdmin(); 
            }
        }

        function intentarAccesoAdmin() {
            if (!document.getElementById('modulo-admin').classList.contains('hidden')) return; 
            document.getElementById('modal-password').classList.remove('hidden');
            setTimeout(() => document.getElementById('admin-user-input').focus(), 100);
        }

        function cerrarModalPassword() {
            document.getElementById('modal-password').classList.add('hidden');
            document.getElementById('admin-user-input').value = "";
            document.getElementById('admin-pass-input').value = "";
        }

        async function verificarPasswordAdmin() {
            const user = document.getElementById('admin-user-input').value;
            const pass = document.getElementById('admin-pass-input').value;

            const res = await fetch(`${BASE_URL}/api/auth/admin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usuario: user, clave: pass })
            });
            const data = await res.json();

            if (data.success) {
                cerrarModalPassword(); 
                cambiarModulo('admin');
            } else {
                alert("❌ " + data.message);
                document.getElementById('admin-pass-input').value = "";
                document.getElementById('admin-pass-input').focus();
            }
        }

        function cargarSelectorPartidosCliente(keepValue = null) {
            const select = document.getElementById('c-partido-select');
            select.innerHTML = '<option value="">-- Selecciona un partido del fixture --</option>';
            
            const partidosAbiertos = dbPartidos.filter(p => p.estado === 'ABIERTO');
            if(partidosAbiertos.length === 0) {
                select.innerHTML = '<option value="">-- No hay partidos disponibles en taquilla --</option>';
                select.disabled = true;
            } else {
                select.disabled = false;
                partidosAbiertos.forEach(p => {
                    select.innerHTML += `<option value="${p.id}">⚔️ ${p.eq1} vs ${p.eq2}</option>`;
                });
                if (keepValue && partidosAbiertos.find(p => p.id == keepValue)) {
                    select.value = keepValue;
                }
            }
            actualizarBotonesPartidoCliente();
        }

        function actualizarBotonesPartidoCliente() {
            const partidoId = parseInt(document.getElementById('c-partido-select').value);
            const containerBtns = document.getElementById('c-opciones-apuesta');
            const inputMonto = document.getElementById('c-monto');
            const btnSubmit = document.getElementById('btn-submit-apuesta');

            if(!partidoId) {
                containerBtns.classList.add('opacity-50', 'pointer-events-none');
                inputMonto.disabled = true; btnSubmit.disabled = true;
                document.getElementById('lbl-btn-eq1').innerText = "LOCAL";
                document.getElementById('lbl-btn-eq2').innerText = "VISITA";
                resetearBotonesPrediccion();
                return;
            }

            const partido = dbPartidos.find(p => p.id === partidoId);
            if(partido) {
                containerBtns.classList.remove('opacity-50', 'pointer-events-none');
                inputMonto.disabled = false; btnSubmit.disabled = false;
                document.getElementById('lbl-btn-eq1').innerText = partido.eq1;
                document.getElementById('lbl-btn-eq2').innerText = partido.eq2;
                calcularVistaCliente();
            }
        }

        function resetearBotonesPrediccion() {
            document.getElementById('prediccion-seleccionada').value = "";
            ['btn-local', 'btn-empate', 'btn-visitante'].forEach(id => { document.getElementById(id).className = "bg-slate-800 border-2 border-transparent p-3 rounded-xl text-center transition cursor-pointer hover:bg-slate-700 hover:border-yellow-500/50"; });
            document.getElementById('c-ganancia-est').innerText = "$0.00";
        }

        function resetearFormularioApuestaCliente() {
            document.getElementById('form-apuesta').reset();
            resetearBotonesPrediccion();
            actualizarBotonesPartidoCliente();
        }

        function seleccionarPrediccion(prediccionCodigo) {
            document.getElementById('prediccion-seleccionada').value = prediccionCodigo;
            ['btn-local', 'btn-empate', 'btn-visitante'].forEach(id => { document.getElementById(id).className = "bg-slate-800 border-2 border-transparent p-3 rounded-xl text-center transition cursor-pointer hover:bg-slate-700 hover:border-yellow-500/50"; });
            let btnSel = prediccionCodigo === 'EQ1' ? 'btn-local' : (prediccionCodigo === 'EMP' ? 'btn-empate' : 'btn-visitante');
            document.getElementById(btnSel).className = "bg-green-600/20 border-2 border-green-500 p-3 rounded-xl text-center transition cursor-pointer text-white shadow-[0_0_15px_rgba(34,197,94,0.3)]";
            calcularVistaCliente();
        }

        function calcularVistaCliente() {
            const partidoId = parseInt(document.getElementById('c-partido-select').value);
            const monto = parseFloat(document.getElementById('c-monto').value);
            const prediccion = document.getElementById('prediccion-seleccionada').value;
            
            if (!partidoId || !monto || !prediccion) { document.getElementById('c-ganancia-est').innerText = "$0.00"; return; }

            const totalesBase = getTotalesPartido(partidoId);
            
            let fTotales = {
                pTotal: totalesBase.pTotal + monto,
                pEq1: totalesBase.pEq1 + (prediccion==='EQ1'?monto:0),
                pEmp: totalesBase.pEmp + (prediccion==='EMP'?monto:0),
                pEq2: totalesBase.pEq2 + (prediccion==='EQ2'?monto:0),
                tFijas: totalesBase.tFijas + TARIFA_SERVICIO
            };

            const premioEst = calcularPremio(monto, prediccion, fTotales);
            document.getElementById('c-ganancia-est').innerText = `$${premioEst.toFixed(2)}`;
        }

        document.getElementById('form-apuesta').addEventListener('submit', function(e) {
            e.preventDefault();
            if(!currentUser) return;
            
            const partidoId = parseInt(document.getElementById('c-partido-select').value);
            const prediccion = document.getElementById('prediccion-seleccionada').value;
            const monto = parseFloat(document.getElementById('c-monto').value);

            if(!partidoId || !prediccion) { alert("Selecciona un partido y quién gana."); return; }
            
            tempApuesta = {
                partidoId: partidoId,
                cedula: currentUser.cedula,
                prediccion: prediccion, 
                monto: monto
            };

            document.getElementById('m-apuesta').innerText = `$${monto.toFixed(2)}`;
            document.getElementById('m-total').innerText = `$${(monto + TARIFA_SERVICIO).toFixed(2)}`;
            document.getElementById('modal-pago').classList.remove('hidden');
        });

        function cerrarModalPago() { document.getElementById('modal-pago').classList.add('hidden'); tempApuesta = null; }

        async function enviarSolicitudApuesta() {
            const res = await fetch(`${BASE_URL}/api/tickets/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(tempApuesta)
            });
            const data = await res.json();
            
            if (data.success) {
                const montoPagar = (tempApuesta.monto + TARIFA_SERVICIO).toFixed(2);
                const idTicket = data.id;
                
                cerrarModalPago();
                resetearFormularioApuestaCliente();
                await cargarDatosDelServidor();
                
                const mensajeWA = encodeURIComponent(`¡Hola! Acabo de generar un ticket de apuesta. ⚽\n\n*ID del Ticket:* #${idTicket}\n*Monto a pagar:* $${montoPagar}\n\nTe envío mi comprobante de pago para que lo apruebes en el sistema.`);
                document.getElementById('btn-whatsapp-pago').href = `https://wa.me/${NUMERO_WHATSAPP}?text=${mensajeWA}`;
                
                document.getElementById('modal-exito-apuesta').classList.remove('hidden');
                renderizarTicketsCliente(); 
            } else {
                alert("Error creando ticket: " + data.message);
                cerrarModalPago();
            }
        }

        function renderizarTicketsCliente() {
            if(!currentUser) return;
            const contenedor = document.getElementById('resultados-cliente');
            contenedor.innerHTML = '';

            const misTickets = dbTickets.filter(t => t.cedula === currentUser.cedula);
            
            if(misTickets.length === 0) {
                contenedor.innerHTML = `<div class="text-center text-slate-400 font-medium py-12 bg-slate-900/60 rounded-xl border border-slate-700/50">Aún no hay tickets en tu mochila.<br>¡Ve por la copa! 🏆</div>`;
                return;
            }

            misTickets.slice().reverse().forEach(t => {
                const partido = dbPartidos.find(p => p.id === t.partidoId);
                if(!partido) return; 

                const totalesPartido = getTotalesPartido(partido.id);
                const premioActual = calcularPremio(t.monto, t.prediccion, totalesPartido);
                
                let estadoVisual = ""; let botonAccionHTML = "";

                if (!t.aprobado) {
                    estadoVisual = `<span class="bg-indigo-900/50 text-indigo-300 border border-indigo-500/50 text-[10px] px-2 py-1 rounded font-bold uppercase animate-pulse">⏳ Falta Pago</span>`;
                    const msjWA = encodeURIComponent(`¡Hola! Quiero enviar el comprobante de mi ticket pendiente. ⚽\n\n*ID del Ticket:* #${t.id}\n*Monto:* $${(t.monto + TARIFA_SERVICIO).toFixed(2)}`);
                    botonAccionHTML = `<a href="https://wa.me/${NUMERO_WHATSAPP}?text=${msjWA}" target="_blank" class="w-full sm:w-auto bg-[#25D366] hover:bg-[#1ebe57] text-white font-black py-2 px-4 rounded-xl mt-3 sm:mt-0 transition text-sm shadow-[0_0_15px_rgba(37,211,102,0.3)] flex items-center justify-center gap-2 text-center"><span class="text-lg">💬</span> ENVIAR PAGO</a>`;
                
                } else if (partido.estado === 'FINALIZADO') {
                    if (partido.ganador === t.prediccion) {
                        if (t.pagado) {
                            estadoVisual = `<span class="bg-green-900/80 text-green-400 border border-green-500/50 text-[10px] px-2 py-1 rounded font-bold uppercase">Premio Pagado 💸</span>`;
                        } else if (t.reclamado) {
                            estadoVisual = `<span class="bg-yellow-900/80 text-yellow-400 border border-yellow-500/50 text-[10px] px-2 py-1 rounded font-bold uppercase animate-pulse">Procesando Pago ⏳</span>`;
                        } else {
                            estadoVisual = `<span class="bg-yellow-500 text-slate-900 border border-yellow-400 text-[10px] px-2 py-1 rounded font-black uppercase shadow-[0_0_10px_rgba(245,158,11,0.5)]">¡GANASTE! 🏆</span>`;
                            botonAccionHTML = `<button onclick="abrirModalReclamo(${t.id}, '${t.cedula}')" class="w-full sm:w-auto gold-gradient hover:opacity-90 text-slate-900 font-black py-2 px-6 rounded-xl mt-3 sm:mt-0 transition text-sm shadow-[0_0_15px_rgba(245,158,11,0.4)]">COBRAR ORO 💰</button>`;
                        }
                    } else {
                        estadoVisual = `<span class="bg-red-900/30 text-red-400 border border-red-500/30 text-[10px] px-2 py-1 rounded font-bold uppercase">Eliminado ❌</span>`;
                    }
                } else if (partido.estado === 'EN_JUEGO') {
                    estadoVisual = `<span class="bg-blue-900/50 text-blue-300 border border-blue-500/50 text-[10px] px-2 py-1 rounded font-bold uppercase">Rodando Balón ⚽</span>`;
                } else {
                    estadoVisual = `<span class="bg-slate-700/50 text-slate-300 border border-slate-500/50 text-[10px] px-2 py-1 rounded font-bold uppercase">Taquilla Abierta 🎫</span>`;
                }

                const nombrePrediccion = getNombreEquipo(partido, t.prediccion);

                const card = document.createElement('div');
                card.className = `p-4 rounded-xl border flex flex-col sm:flex-row justify-between items-center gap-4 ${!t.aprobado ? 'bg-slate-900/50 border-slate-700/50 grayscale opacity-80' : 'bg-slate-800 border-slate-600 shadow-lg'}`;
                card.innerHTML = `
                    <div class="flex-1 w-full">
                        <div class="flex justify-between items-start mb-2">
                            <span class="font-mono text-[10px] text-yellow-500/70">Ticket #${t.id}</span>
                            ${estadoVisual}
                        </div>
                        <div class="text-[10px] text-slate-400 uppercase tracking-widest mb-1">⚔️ ${partido.eq1} vs ${partido.eq2}</div>
                        <div class="font-black text-xl text-white">
                            <span class="${!t.aprobado ? 'text-slate-400' : 'text-green-400'}">${nombrePrediccion}</span> 
                            <span class="text-sm font-normal text-slate-300">($${t.monto.toFixed(2)})</span>
                        </div>
                    </div>
                    <div class="text-right w-full sm:w-auto flex flex-row sm:flex-col justify-between items-end sm:items-end">
                        <span class="text-[10px] text-slate-400 uppercase tracking-wider block mb-1 font-bold">Retorno Estimado</span>
                        <span class="text-3xl font-black ${!t.aprobado ? 'text-slate-600' : (t.pagado ? 'text-slate-500' : (botonAccionHTML.includes('COBRAR') ? 'text-yellow-400 drop-shadow-md' : 'text-white'))}">
                            ${!t.aprobado ? '---' : '$'+premioActual.toFixed(2)}
                        </span>
                    </div>
                `;

                if(botonAccionHTML !== "") { card.insertAdjacentHTML('beforeend', botonAccionHTML); }
                contenedor.appendChild(card);
            });
        }

        // ============================
        // LÓGICA MÓDULO ADMIN (INVENTARIO)
        // ============================
        function actualizarVistaAdmin() {
            bovedaSupremaTotal = 0;
            const tablaInventario = document.getElementById('tabla-inventario');
            tablaInventario.innerHTML = '';
            
            if(dbPartidos.length === 0) {
                tablaInventario.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-slate-400 italic font-medium">Aún no hay torneos creados. ¡Crea el primer partido arriba!</td></tr>`;
            } else {
                dbPartidos.slice().reverse().forEach(p => {
                    const totales = getTotalesPartido(p.id);
                    let comisionNeta = 0;
                    
                    let htmlEstado = `<span class="bg-green-900/50 text-green-300 border border-green-500/50 px-2 py-1 rounded text-[10px] font-bold">🎫 ABIERTO</span>`;
                    let accionAdmin = `<button onclick="bloquearPartidoAdmin(${p.id})" class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-[10px] font-bold transition shadow-md shadow-blue-500/30">INICIAR ⏱️</button>`;

                    if (p.estado === 'EN_JUEGO') {
                        htmlEstado = `<span class="bg-blue-900/50 text-blue-300 border border-blue-500/50 px-2 py-1 rounded text-[10px] font-bold">⚽ EN JUEGO (Cerrado)</span>`;
                        accionAdmin = `
                            <div class="flex flex-col gap-1 w-32 items-center">
                                <span class="text-[9px] text-slate-400">Declarar Ganador:</span>
                                <div class="flex gap-1">
                                    <button onclick="finalizarPartidoAdmin(${p.id}, 'EQ1')" class="bg-slate-700 hover:bg-slate-600 border border-slate-500 px-2 py-1 rounded text-[9px] font-bold">LOCAL</button>
                                    <button onclick="finalizarPartidoAdmin(${p.id}, 'EMP')" class="bg-slate-700 hover:bg-slate-600 border border-slate-500 px-2 py-1 rounded text-[9px] font-bold">EMP</button>
                                    <button onclick="finalizarPartidoAdmin(${p.id}, 'EQ2')" class="bg-slate-700 hover:bg-slate-600 border border-slate-500 px-2 py-1 rounded text-[9px] font-bold">VISITA</button>
                                </div>
                            </div>
                        `;
                    } else if (p.estado === 'FINALIZADO') {
                        comisionNeta = calcularGananciaNetaCasa(p.id, p.ganador);
                        let ganadorTxt = getNombreEquipo(p, p.ganador);
                        htmlEstado = `<span class="bg-slate-800 text-slate-400 border border-slate-600 px-2 py-1 rounded text-[10px] font-bold">TERMINADO (${ganadorTxt})</span>`;
                        accionAdmin = `<span class="text-emerald-400 font-bold text-[10px]">Cerrado y Contabilizado ✅</span>`;
                    }

                    const gananciaTotalCasa = totales.tFijas + comisionNeta;
                    if(p.estado === 'FINALIZADO') {
                        bovedaSupremaTotal += gananciaTotalCasa;
                    }

                    tablaInventario.innerHTML += `
                        <tr class="hover:bg-slate-800/80 transition">
                            <td class="py-4 px-4"><span class="font-mono text-[10px] text-yellow-500/70">${p.fecha}</span><br><span class="font-bold text-white text-sm">${p.eq1} vs ${p.eq2}</span></td>
                            <td class="py-4 px-4 text-center">${htmlEstado}</td>
                            <td class="py-4 px-4 text-center font-mono text-slate-200 font-bold">$${totales.pTotal.toFixed(2)}</td>
                            <td class="py-4 px-4 text-center font-mono text-green-300 font-bold">$${totales.tFijas.toFixed(2)}</td>
                            <td class="py-4 px-4 text-center font-mono text-green-400 font-bold">${p.estado === 'FINALIZADO' ? '$'+comisionNeta.toFixed(2) : '<span class="text-slate-500 font-sans text-[10px]">-</span>'}</td>
                            <td class="py-4 px-4 text-right font-black font-mono text-yellow-400 text-lg">${p.estado === 'FINALIZADO' ? '$'+gananciaTotalCasa.toFixed(2) : '---'}</td>
                            <td class="py-4 px-4 flex justify-center">${accionAdmin}</td>
                        </tr>
                    `;
                });
            }

            document.getElementById('admin-boveda-suprema').innerText = `$${bovedaSupremaTotal.toFixed(2)}`;

            const tablaPendientes = document.getElementById('tabla-pendientes');
            tablaPendientes.innerHTML = '';
            const pendientesAprobacion = dbTickets.filter(t => !t.aprobado);

            if(pendientesAprobacion.length === 0) {
                tablaPendientes.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-green-300/50 italic">Taquilla vacía. Nadie en fila.</td></tr>`;
            } else {
                pendientesAprobacion.forEach(t => {
                    const partido = dbPartidos.find(p => p.id === t.partidoId);
                    if(!partido) return;
                    const nombrePred = getNombreEquipo(partido, t.prediccion);
                    const totalPagar = t.monto + TARIFA_SERVICIO;
                    
                    tablaPendientes.innerHTML += `
                        <tr class="hover:bg-green-900/20 transition">
                            <td class="py-3 px-3 font-semibold capitalize text-white">${t.nombre} <br><span class="text-[9px] font-mono text-green-200/50">${t.cedula}</span></td>
                            <td class="py-3 px-3 text-center text-[10px] text-slate-300">${partido.eq1.substring(0,3)}v${partido.eq2.substring(0,3)}<br><span class="font-bold text-white bg-slate-800 px-1 rounded">${nombrePred}</span></td>
                            <td class="py-3 px-3 text-right text-green-400 font-black font-mono text-sm">$${totalPagar.toFixed(2)}</td>
                            <td class="py-3 px-3 text-center space-x-1">
                                <button onclick="aprobarApuesta(${t.id})" class="bg-green-600 hover:bg-green-500 text-white text-[10px] px-2 py-1.5 rounded font-bold uppercase transition shadow-md shadow-green-500/20">Aprobar ✅</button>
                                <button onclick="rechazarApuesta(${t.id})" class="bg-red-800 hover:bg-red-700 text-white text-[10px] px-2 py-1.5 rounded font-bold uppercase transition">❌</button>
                            </td>
                        </tr>
                    `;
                });
            }

            const tablaGeneral = document.getElementById('tabla-admin');
            tablaGeneral.innerHTML = '';
            const oficiales = dbTickets.filter(t => t.aprobado);
            
            if(oficiales.length === 0) {
                tablaGeneral.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-slate-500 italic">La cancha está vacía.</td></tr>`;
            } else {
                oficiales.slice().reverse().forEach(t => {
                    const partido = dbPartidos.find(p => p.id === t.partidoId);
                    if(!partido) return;

                    const totalesPartido = getTotalesPartido(partido.id);
                    const premioActual = calcularPremio(t.monto, t.prediccion, totalesPartido);
                    
                    const multiplicadorReal = premioActual / t.monto;
                    let multiplicadorHTML = `<span class="text-slate-300 font-bold">x${multiplicadorReal.toFixed(2)}</span>`;
                    if (multiplicadorReal >= MULTIPLICADOR_MAXIMO) {
                        multiplicadorHTML = `<span class="text-red-400 font-black px-1 rounded border border-red-500/50 bg-red-900/30 text-[10px]">MAX x${MULTIPLICADOR_MAXIMO.toFixed(2)}</span>`;
                    }

                    let estadoText = "EN JUEGO ⚽"; let colorClass = "text-blue-400";
                    if(partido.estado === 'FINALIZADO') {
                        if(partido.ganador === t.prediccion) { 
                            if(t.pagado) { estadoText = "PAGADO 💸"; colorClass = "text-green-500 font-bold"; }
                            else { estadoText = "GANADOR 🏆"; colorClass = "text-yellow-400 font-bold"; }
                        } 
                        else { estadoText = "PERDIDO ❌"; colorClass = "text-slate-500"; }
                    }

                    const nombreEquipo = getNombreEquipo(partido, t.prediccion);

                    tablaGeneral.innerHTML += `
                        <tr class="hover:bg-slate-800/80 transition">
                            <td class="py-3 px-4 font-mono text-[10px] text-yellow-500/50">#${t.id}<br>${t.fecha.split(' ')[0]}</td>
                            <td class="py-3 px-4 font-bold capitalize text-white">${t.nombre} <br><span class="text-[10px] font-mono text-slate-400 font-normal">${t.cedula}</span></td>
                            <td class="py-3 px-4 text-center font-mono text-xs"><span class="bg-slate-800 border border-slate-600 px-2 py-1 rounded text-white font-bold">${nombreEquipo}</span></td>
                            <td class="py-3 px-4 text-center font-mono text-slate-200 font-bold">$${t.monto.toFixed(2)}</td>
                            <td class="py-3 px-4 text-center font-mono text-xs">${multiplicadorHTML}</td>
                            <td class="py-3 px-4 text-right text-yellow-400 font-black font-mono text-sm">$${premioActual.toFixed(2)}</td>
                            <td class="py-3 px-4 text-center text-[10px] font-bold tracking-widest ${colorClass}">${estadoText}</td>
                        </tr>
                    `;
                });
            }

            const tablaReclamos = document.getElementById('tabla-reclamos');
            tablaReclamos.innerHTML = '';
            const reclamosPendientes = oficiales.filter(t => t.reclamado === true && t.pagado === false);
            
            if(reclamosPendientes.length === 0) {
                tablaReclamos.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-yellow-500/50 italic">No hay ganadores reclamando.</td></tr>`;
            } else {
                reclamosPendientes.forEach(t => {
                    const partido = dbPartidos.find(p => p.id === t.partidoId);
                    if(!partido) return;
                    
                    const totales = getTotalesPartido(partido.id);
                    const premioActual = calcularPremio(t.monto, t.prediccion, totales);
                    
                    tablaReclamos.innerHTML += `
                        <tr class="hover:bg-yellow-900/20 transition border-b border-yellow-900/30">
                            <td class="py-2 px-3 font-bold capitalize text-white">${t.nombre} <br><span class="text-[10px] font-mono text-yellow-400">📲 ${t.telefonoContacto}</span></td>
                            <td class="py-2 px-3 text-center text-[10px] text-slate-300 font-bold">${partido.eq1.substring(0,3)}v${partido.eq2.substring(0,3)}</td>
                            <td class="py-2 px-3 text-right text-yellow-400 font-black font-mono text-sm">$${premioActual.toFixed(2)}</td>
                            <td class="py-2 px-3 text-center">
                                <button onclick="marcarPagado(${t.id})" class="gold-gradient text-slate-900 text-[10px] px-3 py-1.5 rounded font-black uppercase transition shadow-md shadow-yellow-500/30 cursor-pointer">PAGADO 💸</button>
                            </td>
                        </tr>
                    `;
                });
            }
        }

        async function aprobarApuesta(id) {
            await fetch(`${BASE_URL}/api/tickets/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            await cargarDatosDelServidor();
        }

        async function rechazarApuesta(id) {
            if(confirm("¿Estás seguro de sacar la Tarjeta Roja y eliminar este boleto?")) {
                await fetch(`${BASE_URL}/api/tickets/reject`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                });
                await cargarDatosDelServidor();
            }
        }

        async function marcarPagado(idTicket) {
            if(confirm("¿Confirmas que la transferencia fue exitosa para este ganador?")) {
                await fetch(`${BASE_URL}/api/tickets/pay`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: idTicket })
                });
                await cargarDatosDelServidor();
            }
        }

        function abrirModalReclamo(idTicket, cedulaOriginal) {
            document.getElementById('reclamo-id').value = idTicket;
            document.getElementById('reclamo-cedula-original').value = cedulaOriginal; 
            document.getElementById('reclamo-cedula').value = ""; 
            document.getElementById('reclamo-telefono').value = "";
            document.getElementById('modal-reclamo').classList.remove('hidden');
        }

        function cerrarModalReclamo() { document.getElementById('modal-reclamo').classList.add('hidden'); }

        async function enviarReclamo(e) {
            e.preventDefault();
            const idTicket = parseInt(document.getElementById('reclamo-id').value);
            const cedulaIngresada = document.getElementById('reclamo-cedula').value.trim().toUpperCase();
            const cedulaOriginal = document.getElementById('reclamo-cedula-original').value;
            const telefono = document.getElementById('reclamo-telefono').value.trim();

            if (cedulaIngresada !== cedulaOriginal) {
                alert("❌ ACCESO DENEGADO.\nLa cédula no coincide con el dueño del boleto.");
                return;
            }

            const ticket = dbTickets.find(t => t.id === idTicket);
            if (ticket) {
                if (ticket.reclamado) {
                    alert("⚠️ Ya mandaste esta solicitud, tranquilo que el árbitro la está revisando."); return;
                }
                
                await fetch(`${BASE_URL}/api/tickets/claim`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: idTicket, telefono: telefono })
                });
            }

            cerrarModalReclamo();
            alert(`✅ ¡SOLICITUD ENVIADA!\n\nEstate atento al WhatsApp (${telefono}), te mandaremos tus ganancias. 💸`);
            await cargarDatosDelServidor();
        }