-- Agrupa produtos por famílias sem fundir estoques, alterar nomes ou mexer em empréstimos.
-- Não sobrescreve grupos definidos manualmente pelo Admin.
-- Não consolida tablets/notebooks: cada unidade tem cadastro e identificação próprios.
CREATE TABLE IF NOT EXISTS agrupamento_variacoes_backup (
 material_id INTEGER PRIMARY KEY,
 grupo_anterior TEXT NOT NULL,
 grupo_sugerido TEXT NOT NULL,
 registrado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO agrupamento_variacoes_backup(material_id,grupo_anterior,grupo_sugerido)
SELECT id,grupo_variacoes,CASE
    WHEN lower(trim(nome)) LIKE 'alcalina %' THEN 'Alcalina'
    WHEN lower(trim(nome)) LIKE 'recarreg%' THEN 'Recarregáveis'
    WHEN lower(trim(nome)) LIKE 'bateria %' THEN 'Baterias'
    WHEN lower(trim(nome)) LIKE 'resistor %' THEN 'Resistores'
    WHEN lower(trim(nome)) LIKE 'capacitor%' THEN 'Capacitores'
    WHEN lower(trim(nome)) LIKE 'led %' THEN 'LEDs'
    WHEN lower(trim(nome)) LIKE 'interruptor %' THEN 'Interruptores'
    WHEN lower(trim(nome)) LIKE 'placas protoboard%' THEN 'Protoboards'
    WHEN lower(trim(nome)) LIKE 'kit jumper%' THEN 'Kit jumper'
    WHEN lower(trim(nome)) LIKE 'suporte para bateria%' THEN 'Suportes para baterias'
    WHEN lower(trim(nome)) LIKE 'suporte para 6 pilhas%' THEN 'Suportes para baterias'
    WHEN lower(trim(nome)) LIKE '%motor%' THEN 'Motores'
    WHEN lower(trim(nome)) LIKE 'roda %' THEN 'Rodas'
    WHEN lower(trim(nome)) LIKE 'sensor %' THEN 'Sensores'
    WHEN lower(trim(nome)) LIKE 'modulo sensor%' THEN 'Sensores'
    WHEN lower(trim(nome)) LIKE 'módulo sensor%' THEN 'Sensores'
    WHEN lower(trim(nome)) LIKE 'fonte %' THEN 'Fontes'
    WHEN lower(trim(nome)) LIKE 'carregador%' THEN 'Carregadores'
    WHEN lower(trim(nome)) LIKE 'joysti%' THEN 'Joysticks'
    WHEN lower(trim(nome)) LIKE 'módulo de alimenta%' THEN 'Módulos de alimentação'
    WHEN lower(trim(nome)) LIKE 'arduino %' THEN 'Arduino'
    WHEN lower(trim(nome)) LIKE 'esp 32%' THEN 'ESP32'
    WHEN lower(trim(nome)) LIKE 'ponte h%' THEN 'Pontes H'
    WHEN lower(trim(nome)) LIKE 'toalha %' THEN 'Toalhas'
    WHEN lower(trim(nome)) LIKE 'cola %' THEN 'Colas'
    ELSE NULL END
FROM componentes
WHERE arquivado=0 AND trim(coalesce(grupo_variacoes,''))=''
  AND (CASE
    WHEN lower(trim(nome)) LIKE 'alcalina %' THEN 'Alcalina'
    WHEN lower(trim(nome)) LIKE 'recarreg%' THEN 'Recarregáveis'
    WHEN lower(trim(nome)) LIKE 'bateria %' THEN 'Baterias'
    WHEN lower(trim(nome)) LIKE 'resistor %' THEN 'Resistores'
    WHEN lower(trim(nome)) LIKE 'capacitor%' THEN 'Capacitores'
    WHEN lower(trim(nome)) LIKE 'led %' THEN 'LEDs'
    WHEN lower(trim(nome)) LIKE 'interruptor %' THEN 'Interruptores'
    WHEN lower(trim(nome)) LIKE 'placas protoboard%' THEN 'Protoboards'
    WHEN lower(trim(nome)) LIKE 'kit jumper%' THEN 'Kit jumper'
    WHEN lower(trim(nome)) LIKE 'suporte para bateria%' THEN 'Suportes para baterias'
    WHEN lower(trim(nome)) LIKE 'suporte para 6 pilhas%' THEN 'Suportes para baterias'
    WHEN lower(trim(nome)) LIKE '%motor%' THEN 'Motores'
    WHEN lower(trim(nome)) LIKE 'roda %' THEN 'Rodas'
    WHEN lower(trim(nome)) LIKE 'sensor %' THEN 'Sensores'
    WHEN lower(trim(nome)) LIKE 'modulo sensor%' THEN 'Sensores'
    WHEN lower(trim(nome)) LIKE 'módulo sensor%' THEN 'Sensores'
    WHEN lower(trim(nome)) LIKE 'fonte %' THEN 'Fontes'
    WHEN lower(trim(nome)) LIKE 'carregador%' THEN 'Carregadores'
    WHEN lower(trim(nome)) LIKE 'joysti%' THEN 'Joysticks'
    WHEN lower(trim(nome)) LIKE 'módulo de alimenta%' THEN 'Módulos de alimentação'
    WHEN lower(trim(nome)) LIKE 'arduino %' THEN 'Arduino'
    WHEN lower(trim(nome)) LIKE 'esp 32%' THEN 'ESP32'
    WHEN lower(trim(nome)) LIKE 'ponte h%' THEN 'Pontes H'
    WHEN lower(trim(nome)) LIKE 'toalha %' THEN 'Toalhas'
    WHEN lower(trim(nome)) LIKE 'cola %' THEN 'Colas'
    ELSE NULL END) IS NOT NULL;
UPDATE componentes
SET grupo_variacoes=(SELECT b.grupo_sugerido
                       FROM agrupamento_variacoes_backup b WHERE b.material_id=componentes.id)
WHERE id IN (SELECT material_id FROM agrupamento_variacoes_backup)
  AND arquivado=0 AND trim(coalesce(grupo_variacoes,''))='';
INSERT INTO historico_admin(criado_em,responsavel,acao,tipo,descricao)
SELECT CURRENT_TIMESTAMP,'Sistema','Vinculou variações iniciais','material',
       grupo_sugerido || ' · ' || COUNT(*) || ' cadastros relacionados, estoques preservados.'
FROM agrupamento_variacoes_backup GROUP BY grupo_sugerido HAVING COUNT(*)>=2;
