if OBJECT_ID(N'dbo.energy_samples_minute', N'U') is null
begin
  create table dbo.energy_samples_minute (
    id bigint IDENTITY(1, 1) not null primary key,
    station_id int not null,
    recorded_at datetime2(3) not null,
    production_w decimal(12, 2) null,
    consumption_w decimal(12, 2) null,
    battery_soc decimal(5, 2) null,
    battery_power_w decimal(12, 2) null,
    grid_import_w decimal(12, 2) null,
    grid_export_w decimal(12, 2) null,
    battery_charge_w decimal(12, 2) null,
    battery_discharge_w decimal(12, 2) null,
    irradiance decimal(12, 2) null,
    created_at datetime2(3) not null constraint df_energy_samples_minute_created_at default SYSUTCDATETIME(),
    constraint uq_energy_samples_minute_station_recorded unique (
      station_id,
      recorded_at
      )
    );
end;

if not exists (
    select 1
    from sys.indexes
    where name = N'idx_energy_samples_minute_recorded_at'
      and object_id = OBJECT_ID(N'dbo.energy_samples_minute')
    )
  create index idx_energy_samples_minute_recorded_at on dbo.energy_samples_minute (recorded_at);

if OBJECT_ID(N'dbo.energy_samples_raw', N'U') is null
begin
  create table dbo.energy_samples_raw (
    id bigint IDENTITY(1, 1) not null primary key,
    source varchar(32) not null,
    station_id int not null,
    fetched_at datetime2(3) not null,
    payload nvarchar(MAX) not null,
    created_at datetime2(3) not null constraint df_energy_samples_raw_created_at default SYSUTCDATETIME(),
    constraint chk_energy_samples_raw_payload_json check (ISJSON(payload) = 1)
    );
end;

if not exists (
    select 1
    from sys.indexes
    where name = N'idx_energy_samples_raw_station_fetched'
      and object_id = OBJECT_ID(N'dbo.energy_samples_raw')
    )
  create index idx_energy_samples_raw_station_fetched on dbo.energy_samples_raw (
    station_id,
    fetched_at
    );

if OBJECT_ID(N'dbo.sync_state', N'U') is null
begin
  create table dbo.sync_state (
    id int IDENTITY(1, 1) not null primary key,
    job_name varchar(64) not null,
    watermark_at datetime2(3) null,
    last_run_at datetime2(3) null,
    last_status varchar(16) not null constraint df_sync_state_last_status default 'idle',
    last_error nvarchar(MAX) null,
    updated_at datetime2(3) not null constraint df_sync_state_updated_at default SYSUTCDATETIME(),
    constraint uq_sync_state_job_name unique (job_name),
    constraint chk_sync_state_last_status check (last_status in ('idle', 'running', 'success', 'error'))
    );
end;
go

create
  or

alter trigger dbo.trg_sync_state_updated_at on dbo.sync_state
after update
as
begin
  set nocount on;

  update dbo.sync_state
  set updated_at = SYSUTCDATETIME()
  from dbo.sync_state as target
  inner join inserted
    on target.id = inserted.id;
end;
go

if OBJECT_ID(N'dbo.app_config', N'U') is null
begin
  create table dbo.app_config (
    id int not null constraint pk_app_config primary key constraint df_app_config_id default 1,
    config nvarchar(MAX) not null,
    updated_at datetime2(3) not null constraint df_app_config_updated_at default SYSUTCDATETIME(),
    constraint chk_app_config_single_config check (id = 1),
    constraint chk_app_config_json check (ISJSON(config) = 1)
    );
end;
go

create
  or

alter trigger dbo.trg_app_config_updated_at on dbo.app_config
after update
as
begin
  set nocount on;

  update dbo.app_config
  set updated_at = SYSUTCDATETIME()
  from dbo.app_config as target
  inner join inserted
    on target.id = inserted.id;
end;
go

if OBJECT_ID(N'dbo.backfill_checkpoint', N'U') is null
begin
  create table dbo.backfill_checkpoint (
    station_id int not null primary key,
    first_data_at datetime2(3) null,
    last_synced_at datetime2(3) null,
    no_data_before datetime2(3) null,
    updated_at datetime2(3) not null constraint df_backfill_checkpoint_updated_at default SYSUTCDATETIME()
    );
end;
go

create
  or

alter trigger dbo.trg_backfill_checkpoint_updated_at on dbo.backfill_checkpoint
after update
as
begin
  set nocount on;

  update dbo.backfill_checkpoint
  set updated_at = SYSUTCDATETIME()
  from dbo.backfill_checkpoint as target
  inner join inserted
    on target.station_id = inserted.station_id;
end;
go

if OBJECT_ID(N'dbo.backfill_gap', N'U') is null
begin
  create table dbo.backfill_gap (
    id bigint IDENTITY(1, 1) not null primary key,
    station_id int not null,
    gap_start datetime2(3) not null,
    gap_end datetime2(3) not null,
    status varchar(16) not null constraint df_backfill_gap_status default 'open',
    created_at datetime2(3) not null constraint df_backfill_gap_created_at default SYSUTCDATETIME(),
    constraint chk_backfill_gap_status check (status in ('open', 'filled', 'ignored'))
    );
end;

if not exists (
    select 1
    from sys.indexes
    where name = N'idx_backfill_gap_station_status'
      and object_id = OBJECT_ID(N'dbo.backfill_gap')
    )
  create index idx_backfill_gap_station_status on dbo.backfill_gap (
    station_id,
    status
    );

if OBJECT_ID(N'dbo.telegram_messages', N'U') is null
begin
  create table dbo.telegram_messages (
    id bigint IDENTITY(1, 1) not null primary key,
    alert_type varchar(64) not null,
    station_id int not null,
    message_text nvarchar(MAX) not null,
    sent_at datetime2(3) not null,
    created_at datetime2(3) not null constraint df_telegram_messages_created_at default SYSUTCDATETIME()
    );
end;

if not exists (
    select 1
    from sys.indexes
    where name = N'idx_telegram_messages_alert_sent'
      and object_id = OBJECT_ID(N'dbo.telegram_messages')
    )
  create index idx_telegram_messages_alert_sent on dbo.telegram_messages (
    alert_type,
    station_id,
    sent_at
    );

if OBJECT_ID(N'dbo.backup_runs', N'U') is null
begin
  create table dbo.backup_runs (
    id bigint IDENTITY(1, 1) not null primary key,
    filename varchar(255) not null,
    size_bytes bigint not null,
    status varchar(16) not null,
    source varchar(16) not null,
    remote_synced bit not null constraint df_backup_runs_remote_synced default 0,
    error_message nvarchar(MAX) null,
    created_at datetime2(3) not null constraint df_backup_runs_created_at default SYSUTCDATETIME(),
    constraint chk_backup_runs_status check (status in ('success', 'failed', 'upload_failed')),
    constraint chk_backup_runs_source check (source in ('scheduled', 'manual'))
    );
end;

if not exists (
    select 1
    from sys.indexes
    where name = N'idx_backup_runs_created'
      and object_id = OBJECT_ID(N'dbo.backup_runs')
    )
  create index idx_backup_runs_created on dbo.backup_runs (created_at);

if not exists (
    select 1
    from sys.indexes
    where name = N'idx_backup_runs_status_created'
      and object_id = OBJECT_ID(N'dbo.backup_runs')
    )
  create index idx_backup_runs_status_created on dbo.backup_runs (
    status,
    created_at
    );

if OBJECT_ID(N'dbo.archive_runs', N'U') is null
begin
  create table dbo.archive_runs (
    id bigint IDENTITY(1, 1) not null primary key,
    station_id int not null,
    direction varchar(16) not null,
    day_from char(10) not null,
    day_to char(10) not null,
    days_count int not null constraint df_archive_runs_days_count default 0,
    rows_affected int not null constraint df_archive_runs_rows_affected default 0,
    status varchar(16) not null,
    error_message nvarchar(MAX) null,
    created_at datetime2(3) not null constraint df_archive_runs_created_at default SYSUTCDATETIME(),
    constraint chk_archive_runs_direction check (direction in ('export', 'hydrate')),
    constraint chk_archive_runs_status check (status in ('success', 'failed', 'partial'))
    );
end;

if not exists (
    select 1
    from sys.indexes
    where name = N'idx_archive_runs_created'
      and object_id = OBJECT_ID(N'dbo.archive_runs')
    )
  create index idx_archive_runs_created on dbo.archive_runs (created_at);

if not exists (
    select 1
    from sys.indexes
    where name = N'idx_archive_runs_station_created'
      and object_id = OBJECT_ID(N'dbo.archive_runs')
    )
  create index idx_archive_runs_station_created on dbo.archive_runs (
    station_id,
    created_at
    );
