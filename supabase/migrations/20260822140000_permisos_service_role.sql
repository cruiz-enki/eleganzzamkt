-- La llave de servicio necesita permisos de tabla.
--
-- Detectado probando el alta de usuarios: insertar en `perfiles` con la llave
-- de servicio devolvía 403. O sea, "crear usuario" habría fallado en
-- producción. La causa: las migraciones que crearon las tablas nuevas dieron
-- permisos SOLO a `authenticated`, y eso dejó fuera a `service_role` en 12 de
-- las 15 tablas. Nunca se notó porque las server functions hasta ahora solo
-- tocaban muebles, catalogos y campanas.
--
-- `service_role` es la llave del servidor: se salta RLS por diseño y nunca
-- viaja al navegador (verificado en el bundle). Que tenga permisos de tabla es
-- el comportamiento normal de Supabase; aquí se restituye.

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant all privileges on all functions in schema public to service_role;

-- Y que las tablas que se creen en el futuro nazcan con el mismo permiso,
-- para no repetir este error en la próxima migración.
alter default privileges in schema public
  grant all privileges on tables to service_role;
alter default privileges in schema public
  grant all privileges on sequences to service_role;
alter default privileges in schema public
  grant all privileges on functions to service_role;
