-- One-off data fix: riassegna gli esiti e gli appuntamenti scritti per
-- errore con user_id = "Sportello Bergamo" (role=agente) all'operatrice
-- Beatrice (role=operatore).
--
-- USO: incollare in Supabase SQL Editor (project: hera-appuntamenti) ed
-- eseguire. Lo script fallisce in modo pulito se i nomi non matchano un
-- unico utente, così non riassegna nulla per sbaglio. Avvolto in BEGIN/
-- COMMIT: in caso di errore, nessuna scrittura viene applicata.

BEGIN;

DO $$
DECLARE
  beatrice_id  UUID;
  bergamo_id   UUID;
  outcomes_n   INTEGER;
  appts_n      INTEGER;
BEGIN
  SELECT id INTO beatrice_id
  FROM users
  WHERE role = 'operatore'
    AND name ILIKE 'beatrice%'
  LIMIT 2;

  IF beatrice_id IS NULL THEN
    RAISE EXCEPTION 'Operatrice Beatrice non trovata in users (role=operatore)';
  END IF;
  IF (SELECT COUNT(*) FROM users WHERE role = 'operatore' AND name ILIKE 'beatrice%') > 1 THEN
    RAISE EXCEPTION 'Più operatori col nome che inizia per "Beatrice" - precisare';
  END IF;

  SELECT id INTO bergamo_id
  FROM users
  WHERE role = 'agente'
    AND name ILIKE 'sportello bergamo%'
  LIMIT 2;

  IF bergamo_id IS NULL THEN
    RAISE EXCEPTION 'Utente "Sportello Bergamo" (role=agente) non trovato';
  END IF;
  IF (SELECT COUNT(*) FROM users WHERE role = 'agente' AND name ILIKE 'sportello bergamo%') > 1 THEN
    RAISE EXCEPTION 'Più agenti col nome che inizia per "Sportello Bergamo" - precisare';
  END IF;

  RAISE NOTICE 'Beatrice id: %', beatrice_id;
  RAISE NOTICE 'Sportello Bergamo id: %', bergamo_id;

  UPDATE call_outcomes
     SET user_id = beatrice_id
   WHERE user_id = bergamo_id;
  GET DIAGNOSTICS outcomes_n = ROW_COUNT;

  UPDATE appointments
     SET user_id = beatrice_id
   WHERE user_id = bergamo_id;
  GET DIAGNOSTICS appts_n = ROW_COUNT;

  RAISE NOTICE 'Righe call_outcomes riassegnate: %', outcomes_n;
  RAISE NOTICE 'Righe appointments riassegnate: %', appts_n;
END $$;

COMMIT;
