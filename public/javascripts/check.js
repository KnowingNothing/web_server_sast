let crypto = require('crypto');
let mysql = require('mysql');
let config = require('../../config/mysql.json');
let async = require('async');
let fs = require('fs');

let admin_cfg = config.admin;
let guest_cfg = config.guest;
let store_path = config.store_path;

let pool_admin = mysql.createPool(admin_cfg);
let pool_guest = mysql.createPool(guest_cfg);

function makeid() {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < 10; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}

let check_already_login = function(id, ip_info, timestamp, is_admin, callback)
{
    let threshold = 5 * 60 * 60 * 1000;
    pool_admin.getConnection(function(err, conn){
        if(err){console.log(err);callback(false, null)}
        else
        {
            let sql = `select ip, login_timestamp from login_users where id = ${id};`;
            if(is_admin)
            {
                sql = `select ip, login_timestamp from login_admin where id = ${id};`;
            }
            conn.query(sql, function(err, rows){
                if(err){console.log(err);}
                else
                {
                    if(typeof(rows) === "undefined" || rows.length < 1)
                    {
                        callback(false, false);
                    }
                    else
                    {
                        let old_timestamp = rows[0].login_timestamp;
                        let ip = rows[0].ip;
                        if(timestamp - old_timestamp > threshold || ip !== ip_info)
                        {
                            callback(true, false);
                        }
                        else callback(true, true);
                    }
                }
            });
            conn.release();
        }
    });
}

let add_login = function(id, ip_info, timestamp, is_admin, callback)
{
    let sql = `insert into login_users(id, login_timestamp, ip) values(${id},${timestamp},'${ip_info}');`;
    if(is_admin)
    {
        sql = `insert into login_admin(id, login_timestamp, ip) values(${id},${timestamp},'${ip_info}');`;
    }
    pool_admin.getConnection(function(err, conn){
        if(err)
        {
            console.log(err);
            callback(false);
        }
        else
        {
            conn.query(sql, function(err){
                if(err)
                {
                    console.log(err);
                    callback(false);
                }
                else
                {
                    callback(true);
                }
            });
            conn.release();
        }
    });
}

let refresh_login = function(id, ip_info, timestamp, is_admin, callback)
{
    let sql = `update login_users set login_timestamp = ${timestamp}, ip = '${ip_info}' where id = ${id};`;
    if(is_admin)
    {
        sql = `update login_admin set login_timestamp = ${timestamp}, ip = '${ip_info}' where id = ${id};`;
    }
    pool_admin.getConnection(function(err, conn){
        if(err)
        {
            console.log(err);
            callback(false);
        }
        else
        {
            conn.query(sql, function(err){
                if(err)
                {
                    console.log(err);
                    callback(false);
                }
                else
                {
                    callback(true);
                }
            });
            conn.release();
        }
    });
}

let already_sign_contest = function(id, contest, callback)
{
    pool_admin.getConnection(function(err, conn){
        if(err){console.log(err);callback(false, null);}
        else
        {
            let sql = `select id from contests where info = '${contest}';`;
            conn.query(sql, function(err, rows){
                if(err){console.log(err);callback(false, null);}
                else if(typeof(rows) === "undefined" || rows.length < 1)
                {
                    callback(false, null);
                }
                else
                {
                    let contest_id = rows[0].id;
                    let sql = `select team, team_key from user_contest where id = ${id} and contest = ${contest_id};`;
                    conn.query(sql, function(err, rows1){
                        if(err){console.log(err);callback(false, null);}
                        else if(typeof(rows1) === "undefined" || rows1.length < 1)
                        {
                            callback(false, null);
                        }
                        else
                        {
                            let team_id = rows1[0].team;
                            let team_key = rows1[0].team_key;
                            let sql = `select other,team_name,attend_confirm,prize,file_name from teams where id = ${rows1[0].team};`;
                            conn.query(sql, function(err, rows2){
                                if(err){console.log(err);callback(false, null);}
                                else
                                {
                                    let sql = `select users.name from users,user_contest where users.id=user_contest.id and user_contest.team='${team_id}';`;
                                    conn.query(sql, function(err, rows3){
                                        if(err)
                                        {
                                            console.log(err);
                                            callback(false, null);
                                        }
                                        else
                                        {
                                            let member_info = '';
                                            for(let i = 0; i < rows3.length; ++i)
                                            {
                                                member_info = member_info + rows3[i].name + ' ';
                                            }
                                            callback(true,
                                              {attend_confirm: rows2[0].attend_confirm,
                                              prize: rows2[0].prize,
                                              other: rows2[0].other,
                                              team_name: rows2[0].team_name,
                                              team_id: team_id,
                                              member_info: member_info,
                                              team_key: team_key,
                                              file_name: rows2[0].file_name});
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            });
            conn.release();
        }
    });
}

let sign_contest = function(id, contest, type, callback)
{
    pool_admin.getConnection(function(err, conn){
        if(err){console.log(err);callback(false);}
        else
        {
            let team_id = -1;
            let contest_id = -1;
            let task1 = function(cb)
            {
                let sql = `select id from contests where info = '${contest}';`;
                conn.query(sql, function(err, rows){
                    if(err)
                    {
                        cb(err);
                    }
                    else
                    {
                        contest_id = rows[0].id;
                        cb(null);
                    }
                });
            }
            let task2 = function(cb)
            {
                let team_name = '没有命名的' + id + '号' + contest + '小队';
                let sql = `insert into teams(team_name) values('${team_name}');`;
                conn.query(sql, function(err, rows){
                    if(err)
                    {
                        cb(err);
                    }
                    else
                    {
                        cb(null);
                    }
                });
            }
            let task3 = function(cb)
            {
                let team_name = '没有命名的' + id + '号' + contest + '小队';
                let sql = `select id from teams where team_name = '${team_name}';`;
                conn.query(sql, function(err, rows){
                    if(err)
                    {
                        cb(err);
                    }
                    else
                    {
                        team_id = rows[0].id;
                        cb(null);
                    }
                });
            }
            let task4 = function(cb)
            {
                let newkey = makeid();
                // let key = crypto.createHash('sha256').update(makeid() + new Date()).digest('base64');
                let sql = `insert into user_contest(id, contest, team, type, team_key) values(${id},${contest_id}, ${team_id}, ${type}, '${newkey}');`;
                conn.query(sql, function(err){
                    if(err)
                    {
                        cb(err);
                    }
                    else
                    {
                        cb(null);
                    }
                });
            }
            conn.beginTransaction(function(err){
                if(err){console.log(err);conn.release();callback(false);}
                else
                {
                    async.series([task1,task2,task3,task4], function(err){
                        if(err)
                        {
                            console.log(err);
                            conn.rollback();
                            conn.release();
                            callback(false);
                        }
                        else
                        {
                            conn.commit();
                            conn.release();
                            callback(true);
                        }
                    });
                }
            });
        }
    });
}

let already_sign_activity = function(id, activity, callback)
{
    pool_admin.getConnection(function(err, conn){
        if(err){console.log(err);callback(false, null);}
        else
        {
            let sql = `select id from activities where info = '${activity}';`;
            conn.query(sql, function(err, rows){
                if(typeof(rows) === "undefined" || rows.length < 1)
                {
                    callback(false, null);
                }
                else
                {
                    let activity_id = rows[0].id;
                    let sql = `select attend_confirm,team from user_activity where id = ${id} and activity = ${activity_id};`;
                    conn.query(sql, function(err, rows1){
                        if(err)
                        {
                            console.log(err);
                            callback(false, null);
                        }
                        if(typeof(rows1) === "undefined" || rows1.length < 1)
                        {
                            callback(false, null);
                        }
                        else
                        {
                            callback(true, {
                                attend_confirm: rows1[0].attend_confirm,
                                group: rows1[0].team
                            });
                        }
                    });
                }
            });
            conn.release();
        }
    });
}

let sign_activity = function(id, activity, callback)
{
    pool_admin.getConnection(function(err, conn){
        if(err){console.log(err);callback(false);}
        else
        {
            let sql = `select id from activities where info = '${activity}';`;
            conn.query(sql, function(err, rows){
                if(err){console.log(err);callback(false);}
                else if(typeof(rows) === "undefined" || rows.length < 1)
                {
                    callback(false);
                }
                else
                {
                    let activity_id = rows[0].id;
                    let sql = `insert into user_activity(id, activity) values(${id},${activity_id});`;
                    conn.query(sql, function(err){
                        if(err)
                        {
                            callback(false);
                        }
                        else
                        {
                            callback(true)
                        }
                    });
                }
            });
            conn.release();
        }
    });
}

// 为了位运算方便，group从0开始
// 认为已经先报名了
// add为0表示退出报名，为1表示报名
let change_group = function(id, activity, group, add, callback)
{
    // 用一个数字代表报名的小组，采用位运算
    let sign_ary = new Array(group + 1);
    sign_ary[0] = 1;
    for(let i = 1; i <= group; ++i)
    {
        sign_ary[i] = sign_ary[i - 1] * 2;
    }
    pool_admin.getConnection(function(err, conn){
        if(err)
        {
            console.log(err);
            callback(false);
        }
        else
        {
            let sql = `select id from activities where info = '${activity}';`;
            conn.query(sql, function(err, rows){
                if(err)
                {
                    console.log(err);
                    callback(false);
                }
                else
                {
                    let activity_id = rows[0].id;
                    let sql = `update user_activity set team=team-${sign_ary[group]} where id = ${id} and activity = ${activity_id};`;
                    if(add === 1)
                    {
                        sql = `update user_activity set team=team+${sign_ary[group]} where id = ${id} and activity = ${activity_id};`;
                    }
                    conn.query(sql ,function(err){
                        if(err)
                        {
                            console.log(err);
                            callback(false);
                        }
                        else
                        {
                            callback(true);
                        }
                    });
                }
            });
            conn.release();
        }
    });
}

let change_team_name = function(id, contest, new_team, callback)
{
    pool_admin.getConnection(function(err, conn){
        if(err)
        {
            console.log(err);
            callback(false);
        }
        else
        {
            let sql = `select id from teams where team_name = '${new_team}';`;
            conn.query(sql, function(err, rows1){
                if(err)
                {
                    console.log(err);
                    callback(false);
                }
                else
                {
                    if(rows1 === undefined || rows1.length < 1)
                    {
                        let old_team_id = -1;
                        let contest_id = -1;
                        let task0 = function(cb)
                        {
                            let sql = `select id from contests where info = '${contest}';`;
                            conn.query(sql, function(err, rows){
                                if(err)
                                {
                                    cb(err);
                                }
                                else
                                {
                                    contest_id = rows[0].id;
                                    cb(null);
                                }
                            });
                        }
                        let task1 = function(cb)
                        {
                            let sql = `select team from user_contest where id=${id} and contest=${contest_id};`;
                            conn.query(sql, function(err, rows){
                                if(err)
                                {
                                    cb(err);
                                }
                                else
                                {
                                    old_team_id = rows[0].team;
                                    cb(null);
                                }
                            });
                        }
                        let task2 = function(cb)
                        {
                            let sql = `update teams set team_name='${new_team}' where id=${old_team_id};`;
                            conn.query(sql, function(err){
                                if(err)
                                {
                                    cb(err);
                                }
                                else
                                {
                                    cb(null);
                                }
                            });
                        }
                        conn.beginTransaction(function(err){
                            if(err)
                            {
                                console.log(err);
                                callback(false);
                            }
                            else
                            {
                                async.series([task0,task1,task2],function(err){
                                    if(err)
                                    {
                                        console.log(err);
                                        conn.rollback();
                                        callback(false);
                                    }
                                    else
                                    {
                                        conn.commit();
                                        callback(true);
                                    }
                                });
                            }
                        });
                    }
                    else
                    {
                        callback(false);
                    }
                }
            });
            conn.release();
        }
    });
}

let add_team = function(id, contest, new_team, callback)
{
    pool_admin.getConnection(function(err, conn){
        if(err)
        {
            console.log(err);
            callback(false);
        }
        else
        {
            let sql = `select id from teams where team_name = '${new_team}';`;
            conn.query(sql, function(err, rows1){
                if(err)
                {
                    console.log(err);
                    callback(false);
                }
                else
                {
                    if(rows1 === undefined || rows1.length < 1)
                    {
                        let old_team_id = -1;
                        let new_team_id = -1;
                        let contest_id = -1;
                        let task0 = function(cb)
                        {
                            let sql = `select id from contests where info = '${contest}';`;
                            conn.query(sql, function(err, rows){
                                if(err)
                                {
                                    cb(err);
                                }
                                else
                                {
                                    contest_id = rows[0].id;
                                    cb(null);
                                }
                            });
                        }
                        let task1 = function(cb)
                        {
                            let sql = `insert into teams(team_name) values('${new_team}');`;
                            conn.query(sql, function(err){
                                if(err)
                                {
                                    cb(err);
                                }
                                else
                                {
                                    cb(null);
                                }
                            });
                        }
                        let task2 = function(cb)
                        {
                            let sql = `select team from user_contest where id = ${id};`;
                            conn.query(sql, function(err, rows){
                                if(err)
                                {
                                    cb(err);
                                }
                                else
                                {
                                    old_team_id = rows[0].team;
                                    cb(null);
                                }
                            });
                        }
                        let task3 = function(cb)
                        {
                            let sql = `select id from teams where team_name = '${new_team}';`;
                            conn.query(sql, function(err, rows){
                                if(err)
                                {
                                    cb(err);
                                }
                                else
                                {
                                    new_team_id = rows[0].id;
                                    cb(null);
                                }
                            });
                        }
                        let task4 = function(cb)
                        {
                            let sql = `update user_contest set team = ${new_team_id} where id = ${id} and contest = ${contest_id};`;
                            conn.query(sql, function(err){
                                if(err)
                                {
                                    cb(err);
                                }
                                else
                                {
                                    cb(null);
                                }
                            });
                        }
                        let task5 = function(cb)
                        {
                            let sql = `update teams set members = members-1 where id = ${old_team_id};`;
                            conn.query(sql, function(err){
                                if(err)
                                {
                                    cb(err);
                                }
                                else
                                {
                                    cb(null);
                                }
                            });
                        }
                        let task6 = function(cb)
                        {
                            let sql = `select members from teams where id = ${old_team_id};`;
                            conn.query(sql, function(err, rows){
                                if(err)
                                {
                                    cb(err);
                                }
                                else
                                {
                                    let number = rows[0].members;
                                    if(number < 1)
                                    {
                                        let sql = `delete from teams where id = ${old_team_id};`;
                                        conn.query(sql, function(err){
                                            if(err)
                                            {
                                                cb(err);
                                            }
                                            else
                                            {
                                                cb(null);
                                            }
                                        });
                                    }
                                    else
                                    {
                                        cb(null);
                                    }
                                }
                            });
                        }
                        conn.beginTransaction(function(err){
                            if(err)
                            {
                                console.log(err);
                                callback(false);
                            }
                            else
                            {
                                async.series([task0,task1,task2,task3,task4,task5,task6],function(err){
                                    if(err)
                                    {
                                        console.log(err);
                                        conn.rollback();
                                        callback(false);
                                    }
                                    else
                                    {
                                        conn.commit();
                                        callback(true);
                                    }
                                });
                            }
                        });
                    }
                    else
                    {
                        callback(false);
                    }
                }
            });
            conn.release();
        }
    });
}

let add_score = function(id, contest, judge, val, callback) {
    let sql = `insert into score(id, contest, team, type) values(${id},${contest_id}, ${team_id}, ${type});`;
    pool_admin.getConnection(function(err, conn){
        if(err)
        {
            console.log(err);
            callback(false);
        }
        else
        {
            conn.query(sql, function(err){
                if(err)
                {
                    console.log(err);
                    callback(false);
                }
                else
                {
                    callback(true);
                }
            });
            conn.release();
        }
    });
}
let get_university = function(id, callback)
{
    pool_admin.getConnection(function(err, conn){
        if(err)
        {
            console.log(err);
            callback(false, null);
        }
        else
        {
            let sql = `select university from users where id = ${id};`;
            conn.query(sql, function(err, rows){
                if(err)
                {
                    console.log(err);
                    callback(false, null);
                }
                else
                {
                    if(rows === undefined || rows.length < 1)
                    {
                        callback(false, null);
                    }
                    else
                    {
                        callback(true, rows[0].university);
                    }
                }
            });
            conn.release();
        }
    });
}

let get_id = function(number, university, callback)
{
    pool_admin.getConnection(function(err, conn){
        if(err)
        {
            console.log(err);
            callback(false, null);
        }
        else
        {
            let sql = `select id from users where number = ${number} and university = ${university};`;
            conn.query(sql, function(err, rows){
                if(err)
                {
                    console.log(err);
                    callback(false, null);
                }
                else
                {
                    if(rows === undefined || rows.length < 1)
                    {
                        callback(false, null);
                    }
                    else
                    {
                        callback(true, rows[0].id);
                    }
                }
            });
            conn.release();
        }
    });
}

let get_type = function(id, contest, callback)
{
    let cid = 1;
    if (contest === "jiying") cid = 2;
    pool_admin.getConnection(function(err, conn){
        if(err)
        {
            console.log(err);
            callback(false, null);
        }
        else
        {
            let sql = `select type from user_contest where id = ${id} and contest = ${cid}`;
            conn.query(sql, function(err, rows){
                if(err)
                {
                    console.log(err);
                    callback(false, null);
                }
                else
                {
                    if(rows === undefined || rows.length < 1)
                    {
                        callback(false, null);
                    }
                    else
                    {
                        // console.log('Type is ' + rows[0].type);
                        callback(true, rows[0].type);
                    }
                }
            });
            conn.release();
        }
    });
}

let get_file_name = function(group_id, callback)
{
    pool_admin.getConnection(function(err, conn){
        if(err)
        {
            console.log(err);
            callback(false, null);
        }
        else
        {
            let sql = `select file_name from teams where id = ${group_id}`;
            conn.query(sql, function(err, rows){
                if(err)
                {
                    console.log(err);
                    callback(false, null);
                }
                else
                {
                    if(rows === undefined || rows.length < 1)
                    {
                        callback(false, null);
                    }
                    else
                    {
                        callback(true, rows[0].file_name);
                    }
                }
            });
            conn.release();
        }
    });
}

let get_group = function(id, contest, callback)
{
  let cid = 1;
  if (contest === "jiying") cid = 2;
    pool_admin.getConnection(function(err, conn){
        if(err)
        {
            console.log(err);
            callback(false, null);
        }
        else
        {
            let sql = `select team from user_contest where id = ${id} and contest = ${cid};`;
            conn.query(sql, function(err, rows){
                if(err)
                {
                    console.log(err);
                    callback(false, null);
                }
                else
                {
                    if(rows === undefined || rows.length < 1)
                    {
                        callback(false, null);
                    }
                    else
                    {
                        callback(true, rows[0].team);
                    }
                }
            });
            conn.release();
        }
    });
}

let add_member = function(id, contest, new_id, key, callback)
{
    pool_admin.getConnection(function(err, conn){
        if(err)
        {
            console.log(err);
            return callback(false);
        }
        else
        {
            let new_team_id = -1;
            let old_team_id = -1;
            let contest_id = -1;
            let sql = `select id from contests where info = '${contest}';`;
            conn.query(sql, function(err, rows0){
                if(err)
                {
                    console.log(err);
                    return callback(false);
                }
                else if(rows0 === undefined || rows0.length < 1)
                {
                    console.log('没有记录的比赛')
                    return callback(false);
                }
                else
                {
                    contest_id = rows0[0].id;
                    let sql = `select team from user_contest where id = ${id} and contest = ${contest_id};`;
                    conn.query(sql, function(err, rows){
                        if(err)
                        {
                            console.log(err);
                            return callback(false);
                        }
                        else
                        {
                            new_team_id = rows[0].team;
                            let sql = `select members from teams where id = ${new_team_id};`;
                            conn.query(sql, function(err, rows1){
                                if(err)
                                {
                                    console.log(err);
                                    return callback(false);
                                }
                                else
                                {
                                    if(rows1[0].members < 3)
                                    {
                                        let task1 = function(cb)
                                        {
                                            let sql = `select team, team_key from user_contest where id = ${new_id} and contest = ${contest_id};`;
                                            conn.query(sql, function(err, rows){
                                                if(err)
                                                {
                                                    cb(err);
                                                }
                                                else
                                                {
                                                    if (rows[0].team_key != key) {
                                                      cb('key not correct');
                                                    }
                                                    old_team_id = rows[0].team;
                                                    cb(null);
                                                }
                                            });
                                        }
                                        let task2 = function(cb)
                                        {
                                            let sql = `update user_contest set team = ${new_team_id} where id = ${new_id} and contest = ${contest_id};`;
                                            conn.query(sql, function(err){
                                                if(err)
                                                {
                                                    cb(err);
                                                }
                                                else
                                                {
                                                    cb(null);
                                                }
                                            });
                                        }
                                        let task3 = function(cb)
                                        {
                                            let sql = `update teams set members = members-1 where id = ${old_team_id};`;
                                            conn.query(sql, function(err){
                                                if(err)
                                                {
                                                    cb(err);
                                                }
                                                else
                                                {
                                                    cb(null);
                                                }
                                            });
                                        }
                                        let task_before4 = function(cb)
                                        {
                                            let sql = `update teams set members=members+1 where id = ${new_team_id};`
                                            conn.query(sql, function(err){
                                                if(err)
                                                {
                                                    cb(err);
                                                }
                                                else
                                                {
                                                    cb(null);
                                                }
                                            });
                                        }
                                        let task4 = function(cb)
                                        {
                                            let sql = `select members from teams where id = ${old_team_id};`;
                                            conn.query(sql, function(err, rows){
                                                if(err)
                                                {
                                                    cb(err);
                                                }
                                                else
                                                {
                                                    let number = rows[0].members;
                                                    if(number < 1)
                                                    {
                                                        let sql = `delete from teams where id = ${old_team_id};`;
                                                        conn.query(sql, function(err){
                                                            if(err)
                                                            {
                                                                cb(err);
                                                            }
                                                            else
                                                            {
                                                                cb(null);
                                                            }
                                                        });
                                                    }
                                                    else
                                                    {
                                                        cb(null);
                                                    }
                                                }
                                            });
                                        }
                                        conn.beginTransaction(function(err){
                                            if(err)
                                            {
                                                console.log(err);
                                                return callback(false);
                                            }
                                            else
                                            {
                                                async.series([task1,task2,task3,task_before4,task4],function(err){
                                                    if(err)
                                                    {
                                                        console.log(err);
                                                        conn.rollback();
                                                        return callback(false);
                                                    }
                                                    else
                                                    {
                                                        conn.commit();
                                                        return callback(true);
                                                    }
                                                });
                                            }
                                        });
                                    }
                                    else
                                    {
                                        callback(false);
                                    }
                                }
                            });
                        }
                    });
                }
            });
            conn.release();
        }
    });
}

let check_team = function(team, callback)
{
    pool_admin.getConnection(function(err, conn){
        if(err)
        {
            console.log(err);
            callback(false);
        }
        else
        {
            let sql = `update teams set attend_confirm = 1 where id = ${team};`;
            conn.query(sql, function(err){
                if(err)
                {
                    console.log(err);
                    callback(false);
                }
                else
                {
                    callback(true);
                }
            });
        }
    });
}

let give_prize = function(team, prize, callback)
{
    pool_admin.getConnection(function(err, conn){
        if(err)
        {
            console.log(err);
            callback(false);
        }
        else
        {
            let sql = `update teams set prize = ${prize} where id = ${team};`;
            conn.query(sql, function(err){
                if(err)
                {
                    console.log(err);
                    callback(false);
                }
                else
                {
                    callback(true);
                }
            });
        }
    });
}

let check_activity = function(id, activity, group, callback)
{
    let group_ary = new Array(group + 1);
    group_ary[0] = 1;
    for(let i = 1; i <= group; ++i)
    {
        group_ary[i] = group_ary[i - 1] * 2;
    }
    pool_admin.getConnection(function(err, conn){
        if(err)
        {
            console.log(err);
            callback(false, "签到失败，请重试");
        }
        else
        {
            let sql = `select id from activities where info = '${activity}';`;
            conn.query(sql, function(err, rows0){
                if(err)
                {
                    console.log(err);
                    callback(false, "签到失败，请重试");
                }
                else
                {
                    let activity_id = rows0[0].id;
                    let sql = `select attend_confirm,team from user_activity where id = ${id} and activity = ${activity_id};`;
                    conn.query(sql, function(err, rows){
                        if(err || rows === undefined || rows.length < 1)
                        {
                            console.log(err);
                            callback(false, "该志愿者不存在，请检查信息");
                        }
                        else
                        {
                            let flag1 = rows[0].team / group_ary[group] % 2;//的确报名了这一组
                            let flag2 = rows[0].attend_confirm / group_ary[group] % 2;//的确还没有签过到
                            if(flag1 >= 1 && flag2 < 1)
                            {
                                let sql = `update user_activity set attend_confirm=attend_confirm+${group_ary[group]} where id = ${id} and activity = ${activity_id};`;
                                conn.query(sql, function(err){
                                    if(err)
                                    {
                                        console.log(err);
                                        callback(false, "签到失败，请重试");
                                    }
                                    else
                                    {
                                        callback(true, "签到成功");
                                    }
                                });
                            }
                            else
                            {
                                callback(false, "该志愿者未报名这一组或者已经签过到了");
                            }
                        }
                    });
                }
            });
        }
    });
}

let handin_works = function(id, contest, name, callback)
{
    pool_admin.getConnection(function(err, conn){
        if(err)
        {
            console.log(err);
            callback(false);
        }
        else
        {
            let sql = `select id from contests where info = '${contest}';`;
            conn.query(sql, function(err, rows){
                if(err)
                {
                    console.log(err);
                    callback(false);
                }
                else
                {
                    let contest_id = rows[0].id;
                    let sql = `select team from user_contest where id = ${id} and contest = ${contest_id};`;
                    conn.query(sql, function(err, rows1){
                        if(err)
                        {
                            console.log(err);
                            callback(false);
                        }
                        else
                        {
                            let team_id = rows1[0].team;
                            let newname = team_id+'.'+name.split('.').slice(1).join('.');
                            newname = newname.substring(0,24);
                            fs.renameSync(store_path+name, store_path+newname);
                            console.log('file rename done, new file name: ' + newname);
                            let sql = `update teams set other = ${id}, file_name = '${newname}' where id = ${team_id};`;
                            conn.query(sql, function(err){
                                if(err)
                                {
                                    console.log(err);
                                    callback(false);
                                }
                                else
                                {
                                    callback(true);
                                }
                            });
                        }
                    });
                }
            });
            conn.release();
        }
    });
}

let logout = function(id, callback)
{
    pool_admin.getConnection(function(err, conn){
        if(err)
        {
            console.log(err);
            callback(false);
        }
        else
        {
            let sql = `delete from login_users where id = ${id}`;
            conn.query(sql, function(err){
                if(err)
                {
                    console.log(err);
                    callback(false);
                }
                else
                {
                    let sql = `delete from login_admin where id = ${id}`;
                    conn.query(sql, function(err){
                        if(err)
                        {
                            console.log(err);
                            callback(false);
                        }
                        else
                        {
                            callback(true);
                        }
                    });
                }
            });
        }
    });
}

module.exports = {
    check_already_login: check_already_login,
    add_login: add_login,
    refresh_login: refresh_login,
    already_sign_contest: already_sign_contest,
    already_sign_activity: already_sign_activity,
    sign_contest: sign_contest,
    sign_activity: sign_activity,
    add_team: add_team,
    add_score: add_score,
    add_member: add_member,
    get_id: get_id,
    get_type: get_type,
    get_university: get_university,
    get_group: get_group,
    get_file_name:get_file_name,
    change_group: change_group,
    check_team: check_team,
    check_activity: check_activity,
    give_prize: give_prize,
    handin_works: handin_works,
    logout: logout,
    change_team_name: change_team_name
};